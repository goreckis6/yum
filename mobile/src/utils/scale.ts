// Ingredient amount scaling helpers, shared between RecipeDetail and ReviewImport.

const TO_TASTE_WORDS = ['do smaku', 'to taste', 'szczypt', 'pinch', 'opcjonaln', 'optional', 'garść', 'garsc'];

// "do smaku" / "szczypta" etc. → sort to the bottom of the list.
export function isToTaste(amount: string): boolean {
  const a = (amount || '').toLowerCase();
  if (TO_TASTE_WORDS.some((w) => a.includes(w))) return true;
  return !/\d/.test(a); // no number at all → unmeasured
}

export function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Math.abs(r - Math.round(r)) < 0.05) return String(Math.round(r));
  const whole = Math.floor(r);
  const frac = r - whole;
  const fractions: [number, string][] = [
    [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'],
  ];
  for (const [v, glyph] of fractions) {
    if (Math.abs(frac - v) < 0.06) return (whole > 0 ? whole : '') + glyph;
  }
  return String(Math.round(r * 10) / 10);
}

// Scale the leading quantity in an amount string by `factor`.
// "340 g" → "170 g", "do smaku" → unchanged.
export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1 || !amount) return amount;
  const m = amount.match(/^\s*(\d+\s*\/\s*\d+|\d*\.?\d+)/);
  if (!m) return amount;
  const raw = m[1];
  let val: number;
  if (raw.includes('/')) {
    const [n, d] = raw.split('/').map((x) => parseFloat(x.trim()));
    val = d ? n / d : n;
  } else {
    val = parseFloat(raw);
  }
  if (!isFinite(val)) return amount;
  return fmtNum(val * factor) + amount.slice(m[0].length);
}
