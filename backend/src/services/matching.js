const aliases = {
  tal: 'taladro',
  perc: 'percutor',
  tram: 'tramontina',
  tramont: 'tramontina',
  pulg: 'pulgadas',
  maq: 'maquina',
  un: 'unidad',
  canos: 'cano',
};
export function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bp\s*\//g, ' para ')
    .replace(/\bc\s*\//g, ' con ')
    .replace(/\bs\s*\//g, ' sin ')
    .replace(/(\d)["″]/g, '$1 pulgadas ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)(mm|cm|mts|mt|m|w|kw|kg|ml|l)\b/g, '$1 $2')
    .replace(/[^a-z0-9./]+/g, ' ')
    .replace(/\b([a-z]+)\.?/g, (_, word) => aliases[word] || word)
    .replace(/\s+/g, ' ')
    .trim();
}
const tokens = (text) => [
  ...new Set(
    normalize(text)
      .split(' ')
      .filter((t) => t && !['para', 'de', 'con', 'el', 'la'].includes(t)),
  ),
];
// Manual overrides can later come from persistent user-confirmed relationships.
export function matchProduct(query, product, override = null) {
  if (override === false) return { score: 0, reasons: ['Descartado manualmente'] };
  if (override === true) return { score: 100, reasons: ['Confirmado manualmente'] };
  const q = tokens(query),
    p = tokens(
      `${product.name} ${product.brand || ''} ${product.model || ''} ${product.measure || ''}`,
    );
  if (
    [product.manufacturerCode, product.code].some(
      (code) => code && normalize(query) === normalize(code),
    )
  )
    return { score: 100, reasons: ['Código exacto (SKU del proveedor o fabricante)'] };
  // Prefixes apply to words, never to numeric measures or model numbers.
  const partial = q.filter(
    (t) =>
      !p.includes(t) &&
      /^[a-z]{3,}$/.test(t) &&
      p.some((word) => /^[a-z]+$/.test(word) && word.startsWith(t)),
  );
  const hits = q.filter((t) => p.includes(t) || partial.includes(t));
  let score = q.length ? Math.round((100 * hits.length) / q.length) : 0;
  const reasons = [];
  if (partial.length) {
    score = Math.min(score, 85);
    reasons.push('Búsqueda parcial: revisar producto');
  }
  const numbers = q.filter((t) => /\d/.test(t));
  if (numbers.some((t) => !p.includes(t))) {
    score = Math.min(score, 65);
    reasons.push('Diferencia de modelo o medida');
  }
  const brands = ['bosch', 'tramontina', 'makita', 'dewalt', 'stanley', 'black', 'bremen'];
  if (q.some((t) => brands.includes(t) && !p.includes(t))) {
    score = Math.min(score, 60);
    reasons.push('Marca distinta o no informada');
  }
  if (q.length < 2 || (!numbers.length && !q.some((t) => brands.includes(t)))) {
    score = Math.min(score, 85);
    reasons.push('Consulta general: revisar identidad');
  }
  if (score >= 90 && hits.length !== q.length) score = 89;
  return { score, reasons };
}
