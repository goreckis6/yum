export const UNICODE_FRACS: [string, number][] = [
  ['¾', 0.75], ['⅔', 0.6667], ['⅝', 0.625], ['½', 0.5],
  ['⅜', 0.375], ['⅓', 0.3333], ['¼', 0.25], ['⅛', 0.125], ['⅞', 0.875],
];

const UNIT_ALIASES: Record<string, string> = {
  tablespoon: 'tbsp', tablespoons: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp',
  cups: 'cup',
  gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  ounce: 'oz', ounces: 'oz',
  pound: 'lb', pounds: 'lb',
  cloves: 'clove',
  slices: 'slice',
  cans: 'can',
  bunches: 'bunch',
  sprigs: 'sprig',
  stalks: 'stalk',
  heads: 'head',
  pieces: 'piece', pcs: 'piece',
  bags: 'bag',
  packages: 'pkg', package: 'pkg', packs: 'pkg', pack: 'pkg',
  handfuls: 'handful',
  pinches: 'pinch',
};

export function normalizeUnit(u: string): string {
  const low = u.toLowerCase().trim();
  return UNIT_ALIASES[low] ?? low;
}

export function parseAmt(a: string): { value: number; unit: string } {
  const s = (a || '').trim();
  if (!s) return { value: 0, unit: '' };

  let value = 0;
  let rest = s;

  const intFracM = s.match(/^(\d+)\s*([¼-¾⅐-⅞])(.*)/u);
  if (intFracM) {
    const frac = UNICODE_FRACS.find(([sym]) => sym === intFracM[2]);
    if (frac) { value = parseInt(intFracM[1], 10) + frac[1]; rest = intFracM[3].trim(); }
  }

  if (value === 0) {
    const frac = UNICODE_FRACS.find(([sym]) => s.startsWith(sym));
    if (frac) { value = frac[1]; rest = s.slice(frac[0].length).trim(); }
  }

  if (value === 0) {
    const m = s.match(/^(\d+)\s*\/\s*(\d+)(.*)/);
    if (m) { value = parseInt(m[1]) / parseInt(m[2]); rest = m[3].trim(); }
  }

  if (value === 0) {
    const m = s.match(/(\d+(?:[.,]\d+)?)(.*)/);
    if (m) { value = parseFloat(m[1].replace(',', '.')); rest = m[2].trim(); }
  }

  const unitWord = rest.split(/\s+/)[0] ?? '';
  return { value, unit: normalizeUnit(unitWord) };
}

export function formatValue(v: number): string {
  if (v <= 0) return '';
  const whole = Math.floor(v);
  const frac = v - whole;
  const FRAC_MAP: [number, string][] = [
    [0.875,'⅞'],[0.75,'¾'],[0.6667,'⅔'],[0.625,'⅝'],
    [0.5,'½'],[0.375,'⅜'],[0.3333,'⅓'],[0.25,'¼'],[0.125,'⅛'],
  ];
  const match = FRAC_MAP.find(([f]) => Math.abs(frac - f) < 0.04);
  if (match) return whole > 0 ? `${whole}${match[1]}` : match[1];
  if (Math.abs(frac) < 0.04) return String(whole || Math.round(v));
  return v.toFixed(1).replace('.0', '');
}

// ─── Unit conversion ────────────────────────────────────────────────────────

// Converts ml → best imperial volume unit
function mlToImperial(ml: number): string {
  if (ml < 1) return `${formatValue(ml)} ml`;
  if (ml < 7.5) return `${formatValue(ml / 4.929)} tsp`;
  if (ml < 45) return `${formatValue(ml / 14.787)} tbsp`;
  if (ml < 60) return `${formatValue(ml / 29.574)} fl oz`;
  if (ml < 960) return `${formatValue(ml / 236.588)} cup`;
  return `${formatValue(ml / 946.353)} qt`;
}

// Converts imperial volume → ml
function imperialVolToMl(value: number, unit: string): number {
  const map: Record<string, number> = {
    tsp: 4.929, tbsp: 14.787, 'fl oz': 29.574, cup: 236.588, qt: 946.353, pt: 473.176,
  };
  return value * (map[unit] ?? 1);
}

// Converts grams → best imperial weight unit
function gToImperial(g: number): string {
  if (g < 14) return `${formatValue(g)} g`;
  if (g < 453) return `${formatValue(g / 28.35)} oz`;
  return `${formatValue(g / 453.592)} lb`;
}

const METRIC_VOL = new Set(['ml', 'l']);
const METRIC_WEIGHT = new Set(['g', 'kg']);
const IMPERIAL_VOL = new Set(['tsp', 'tbsp', 'cup', 'fl oz', 'qt', 'pt']);
const IMPERIAL_WEIGHT = new Set(['oz', 'lb']);

export function convertAmount(amount: string, to: 'metric' | 'imperial'): string {
  const { value, unit } = parseAmt(amount);
  if (!value || !unit) return amount;

  if (to === 'imperial') {
    if (METRIC_WEIGHT.has(unit)) {
      const g = unit === 'kg' ? value * 1000 : value;
      return gToImperial(g);
    }
    if (METRIC_VOL.has(unit)) {
      const ml = unit === 'l' ? value * 1000 : value;
      return mlToImperial(ml);
    }
  }

  if (to === 'metric') {
    if (IMPERIAL_WEIGHT.has(unit)) {
      const g = unit === 'lb' ? value * 453.592 : value * 28.35;
      return g >= 1000
        ? `${formatValue(g / 1000)} kg`
        : `${formatValue(g)} g`;
    }
    if (IMPERIAL_VOL.has(unit)) {
      const ml = imperialVolToMl(value, unit);
      return ml >= 1000
        ? `${formatValue(ml / 1000)} l`
        : `${formatValue(ml)} ml`;
    }
  }

  return amount; // unitless / already correct system
}

/**
 * Sum two amount strings. Same unit → numeric sum formatted back.
 * Different units or non-numeric → concatenate with " + ".
 */
export function sumAmounts(a: string, b: string): string {
  const pa = parseAmt(a);
  const pb = parseAmt(b);
  if (pa.value > 0 && pb.value > 0 && pa.unit === pb.unit) {
    const total = pa.value + pb.value;
    const unit = pa.unit ? ` ${pa.unit}` : '';
    return `${formatValue(total)}${unit}`.trim();
  }
  return `${a} + ${b}`;
}
