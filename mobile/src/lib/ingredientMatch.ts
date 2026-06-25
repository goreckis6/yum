import { Ingredient, PantryItem } from '../types';

const UNITS = /\b(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|lbs|piece|pieces|szt|dkg|dag|łyżka|łyżki|łyżek|łyżeczka|łyżeczki|szklanka|szklanki|szklanek|garść|garście|plaster|plastry|puszka|puszki)\b/gi;
const NUMBERS = /[\d.,/]+/g;
const PARENS = /\(.*?\)/g;
const EXTRA = /[^a-ząćęłńóśźż\s]/gi;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(PARENS, '')
    .replace(UNITS, '')
    .replace(NUMBERS, '')
    .replace(EXTRA, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(s: string): string[] {
  return normalize(s).split(' ').filter((w) => w.length > 2);
}

function isMatch(ingName: string, pantryName: string): boolean {
  const iWords = wordsOf(ingName);
  const pWords = wordsOf(pantryName);
  if (!iWords.length || !pWords.length) return false;
  // any ingredient word is contained in any pantry word or vice versa
  return iWords.some((iw) => pWords.some((pw) => pw.includes(iw) || iw.includes(pw)));
}

export interface MatchResult {
  total: number;
  matched: number;
  missing: string[];
}

export function matchIngredients(ingredients: Ingredient[], pantry: PantryItem[]): MatchResult {
  const total = ingredients.length;
  const missing: string[] = [];

  for (const ing of ingredients) {
    const found = pantry.some((p) => isMatch(ing.n, p.name));
    if (!found) missing.push(ing.n);
  }

  return { total, matched: total - missing.length, missing };
}
