// Ingredient amount scaling helpers, shared between RecipeDetail and ReviewImport.

const TO_TASTE_WORDS = ['do smaku', 'to taste', 'szczypt', 'pinch', 'opcjonaln', 'optional', 'garść', 'garsc'];

// "do smaku" / "szczypta" etc. → sort to the bottom of the list.
export function isToTaste(amount: string): boolean {
  const a = (amount || '').toLowerCase();
  if (TO_TASTE_WORDS.some((w) => a.includes(w))) return true;
  return !/\d/.test(a); // no number at all → unmeasured
}

// Strip a leading step number the source already wrote ("1.", "2)", "Step 3:")
// so it doesn't duplicate the UI's own numbered badge.
export function cleanStep(s: string): string {
  return (s || '').replace(/^\s*(?:step\s*)?\d+\s*[.)\-:–]\s*/i, '').trim();
}

// Cooking-friendly fractions, written in plain ASCII so they render in any font.
const FRACTIONS: [number, string][] = [
  [0, ''],
  [0.125, '1/8'],
  [0.25, '1/4'],
  [0.333, '1/3'],
  [0.5, '1/2'],
  [0.667, '2/3'],
  [0.75, '3/4'],
  [1, ''],
];

// Format a number the way a cook expects: whole numbers, simple fractions
// ("1/2"), or mixed numbers ("1 1/2"); falls back to one decimal.
export function fmtNum(n: number): string {
  if (!isFinite(n)) return '';
  const r = Math.round(n * 1000) / 1000;
  const whole = Math.floor(r + 1e-9);
  const frac = r - whole;

  let best: [number, string] = [0, ''];
  let bestDist = 1;
  for (const [v, g] of FRACTIONS) {
    const d = Math.abs(frac - v);
    if (d < bestDist) {
      bestDist = d;
      best = [v, g];
    }
  }

  if (bestDist < 0.06) {
    const [v, glyph] = best;
    const w = whole + (v === 1 ? 1 : 0);
    if (!glyph) return String(w); // whole number
    return w > 0 ? `${w} ${glyph}` : glyph; // "1 1/2" or "1/2"
  }

  // Non-standard fraction → keep it readable with one decimal.
  return String(Math.round(r * 10) / 10);
}

// One quantity token, which may be a mixed number ("1 1/2"), a fraction
// ("1/2"), or a decimal/integer ("1.5", "2").
const QTY = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d*\.?\d+`;

function parseQty(raw: string): number {
  const s = raw.trim();
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/); // mixed "1 1/2"
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/); // fraction "1/2"
  if (m) return Number(m[1]) / Number(m[2]);
  return parseFloat(s);
}

// Scale the leading quantity (or range) in an amount string by `factor`.
// "340 g" → "170 g", "1 1/2 cups" → "3 cups", "2-3 eggs" → "4-6 eggs",
// "do smaku" → unchanged.
export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1 || !amount) return amount;
  const lead = new RegExp(String.raw`^\s*(${QTY})(\s*[-–—]\s*(${QTY}))?`);
  const m = amount.match(lead);
  if (!m) return amount;

  const first = parseQty(m[1]);
  if (!isFinite(first)) return amount;

  let out = fmtNum(first * factor);
  if (m[3]) {
    const second = parseQty(m[3]);
    if (isFinite(second)) out += `–${fmtNum(second * factor)}`;
  }
  return out + amount.slice(m[0].length);
}
