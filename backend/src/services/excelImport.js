import XLSX from 'xlsx';
const clean = (value) => String(value ?? '').trim();
const normal = (value) =>
  clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const aliases = {
  name: ['descripcion', 'producto', 'articulo', 'detalle', 'denominacion', 'nombre'],
  price: ['precio', 'precio lista', 'lista', 'importe', 'pvp', 'costo'],
  code: ['codigo', 'cod', 'sku', 'referencia'],
  brand: ['marca'],
  model: ['modelo'],
  measure: ['medida', 'presentacion', 'unidad'],
  stock: ['stock', 'existencia', 'disponibilidad'],
  manufacturerCode: ['codigo fabricante', 'codigo de fabricante'],
};
export function parsePrice(value, decimal = 'auto') {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  let text = clean(value).replace(/ARS|USD|US\$|\$|\s/gi, '');
  if (decimal === 'auto') {
    if (text.includes('.') && text.includes(','))
      decimal = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    else {
      const separator = text.includes('.') ? '.' : text.includes(',') ? ',' : null;
      if (!separator) decimal = ',';
      else {
        const parts = text.split(separator);
        // 1.234 / 1,234 can mean either thousands or three decimals.
        // Require the user to select a format instead of multiplying a price.
        if (parts.length === 2 && parts[0].length <= 3 && parts[1].length === 3) return null;
        decimal = parts.length > 2 ? (separator === '.' ? ',' : '.') : separator;
      }
    }
  }
  const pattern =
    decimal === ','
      ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,4})?$/
      : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?$/;
  if (!pattern.test(text)) return null;
  text = text
    .split(decimal === ',' ? '.' : ',')
    .join('')
    .replace(decimal, '.');
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function stock(value) {
  if (typeof value === 'number') return value >= 0 ? value > 0 : null;
  const s = normal(value);
  if (['si', 'true', 'disponible', 'en stock'].includes(s)) return true;
  if (['no', 'false', 'sin stock', 'agotado'].includes(s)) return false;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  return null;
}
export function inspectWorkbook(buffer, settings = {}) {
  let book;
  try {
    book = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });
  } catch {
    throw Error('No se pudo leer el Excel. Revisá que no esté dañado ni protegido con contraseña.');
  }
  if (!book.SheetNames.length) throw Error('El archivo no contiene hojas.');
  const sheetName = settings.sheet || book.SheetNames[0],
    sheet = book.Sheets[sheetName];
  if (!sheet) throw Error('La hoja elegida no existe en este archivo.');
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  if (range.e.r >= 100000 || range.e.c >= 200)
    throw Error(
      'La hoja supera el límite de 100.000 filas o 200 columnas. Dividila antes de importar.',
    );
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: true,
    range: 0,
  });
  const suggest = (row) =>
    Object.fromEntries(
      Object.entries(aliases).map(([field, names]) => [
        field,
        row.findIndex((v) => names.includes(normal(v))),
      ]),
    );
  let best = 0,
    bestScore = -1;
  rows.slice(0, 100).forEach((row, i) => {
    const map = suggest(row),
      score =
        (map.name >= 0 ? 4 : 0) +
        (map.price >= 0 ? 4 : 0) +
        Object.values(map).filter((n) => n >= 0).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  const header = Number(settings.header ?? best + 1);
  if (!Number.isInteger(header) || header < 1 || header > rows.length)
    throw Error('La fila de encabezados no es válida.');
  const mapping = settings.mapping || suggest(rows[header - 1]);
  const start = Number(settings.start ?? header + 1),
    end = Number(settings.end ?? rows.length);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end > rows.length ||
    start > end
  )
    throw Error('Revisá la primera y última fila de datos.');
  const config = {
    sheet: sheetName,
    header,
    start,
    end,
    mapping,
    decimal: settings.decimal || 'auto',
    currency: settings.currency || 'ARS',
    tax: settings.tax || 'unknown',
  };
  if (
    !['auto', ',', '.'].includes(config.decimal) ||
    !['ARS', 'USD'].includes(config.currency) ||
    !['included', 'excluded', 'unknown'].includes(config.tax)
  )
    throw Error('Formato de precio inválido.');
  const mapped = Object.values(mapping).filter((n) => n !== -1);
  if (
    mapped.some((n) => !Number.isInteger(n) || n < 0 || n > range.e.c) ||
    new Set(mapped).size !== mapped.length
  )
    throw Error('Cada campo debe usar una columna distinta y válida.');
  const ready =
    Number.isInteger(mapping.name) &&
    mapping.name >= 0 &&
    Number.isInteger(mapping.price) &&
    mapping.price >= 0;
  const products = [],
    issues = [];
  let skipped = 0;
  if (ready)
    for (let r = start - 1; r < end; r++) {
      const row = rows[r] || [];
      if (!row.some((v) => clean(v))) continue;
      const value = (field) => row[mapping[field]];
      const name = clean(value('name')),
        price = parsePrice(value('price'), config.decimal);
      if (!name || price === null || /^(sub\s*total|total general|total)$/i.test(name)) {
        skipped++;
        if (issues.length < 30)
          issues.push({
            row: r + 1,
            reason: !name
              ? 'Sin descripción'
              : price === null
                ? 'Precio vacío, inválido o ambiguo: revisá el separador decimal o el valor guardado de la fórmula'
                : 'Fila de totales',
          });
        continue;
      }
      const text = (field) => {
        const c = mapping[field];
        if (c == null || c < 0) return null;
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        return clean(cell?.w ?? value(field)) || null;
      };
      products.push({
        id: String(r + 1),
        name,
        price,
        code: text('code'),
        brand: text('brand'),
        model: text('model'),
        measure: text('measure'),
        manufacturerCode: text('manufacturerCode'),
        stock: stock(value('stock')),
        currency: config.currency,
        tax: config.tax,
        priceStatus: 'available',
        row: r + 1,
      });
    }
  return {
    sheets: book.SheetNames,
    totalRows: rows.length,
    columns: Array.from({ length: range.e.c + 1 }, (_, i) => ({
      index: i,
      label: `${XLSX.utils.encode_col(i)} · ${clean(rows[header - 1]?.[i]) || 'Sin encabezado'}`,
    })),
    settings: config,
    ready,
    count: products.length,
    skipped,
    issues,
    rawPreview: rows
      .slice(Math.max(0, header - 3), Math.min(rows.length, header + 7))
      .map((row, i) => ({
        row: Math.max(0, header - 3) + i + 1,
        values: row.map((v) => clean(v).slice(0, 200)),
      })),
    preview: products.slice(0, 10),
    products,
  };
}
