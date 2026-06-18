import { getApiBaseUrl } from '../config/api';
import { Recipe } from '../types';

export interface ExtractedRecipe extends Omit<Recipe, 'id'> {}

export async function extractRecipeFromUrl(url: string): Promise<{ recipe: ExtractedRecipe; demo: boolean }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/extract-recipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function extractRecipeFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<{ recipe: ExtractedRecipe; demo: boolean }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/extract-recipe-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function checkApiHealth(): Promise<{ ok: boolean; openai: boolean; message: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error('API unreachable');
  return res.json();
}
