export function comparePrices(results) {
  const available = results
    .flatMap((r) => r.products)
    .filter(
      (p) =>
        p.source === 'excel' &&
        p.stock !== false &&
        ['included', 'excluded'].includes(p.tax) &&
        p.currency === 'ARS' &&
        Number.isFinite(p.price) &&
        p.price > 0,
    );
  if (new Set(available.map((p) => p.tax)).size > 1) return { best: null, cheaperPossible: null };
  const best = available.filter((p) => p.score >= 90).sort((a, b) => a.price - b.price)[0] || null;
  const cheaperPossible = best
    ? available
        .filter((p) => p.score < 90 && p.price < best.price)
        .sort((a, b) => a.price - b.price)[0] || null
    : null;
  return { best, cheaperPossible };
}
