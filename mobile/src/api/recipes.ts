import { getApiBaseUrl } from '../config/api';
import { authHeader, mapApiError } from './http';
import { Recipe } from '../types';

export interface ExtractedRecipe extends Omit<Recipe, 'id'> {}

// Reading a caption/page + the OpenAI call can take a while; give it room but
// fail clearly instead of spinning forever if the network stalls.
async function postJson(path: string, body: unknown, timeoutMs = 60000) {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw mapApiError(res.status, err);
    }
    return res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Timed out. Check your connection and try again.');
    if (e?.message === 'Network request failed') {
      throw new Error(`Could not reach the server at ${base}.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractRecipeFromUrl(url: string): Promise<{ recipe: ExtractedRecipe; demo: boolean }> {
  return postJson('/api/extract-recipe', { url });
}

export async function extractRecipeFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<{ recipe: ExtractedRecipe; demo: boolean }> {
  return postJson('/api/extract-recipe-image', { imageBase64, mimeType });
}

export async function enrichRecipe(recipe: ExtractedRecipe): Promise<{ recipe: ExtractedRecipe }> {
  return postJson('/api/enrich-recipe', { recipe });
}

export async function checkApiHealth(): Promise<{ ok: boolean; openai: boolean; message: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error('API unreachable');
  return res.json();
}
