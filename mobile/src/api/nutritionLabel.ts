import { getApiBaseUrl } from '../config/api';
import { authHeader, mapApiError } from './http';

export interface LabelMacros {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface ExtractedNutrition {
  name: string;
  brand: string;
  servingSize: string;
  servingQuantity: number;
  basis: '100g' | '100ml';
  per100: LabelMacros;
  perServing: LabelMacros;
}

export interface LabelShot {
  base64: string;
  mimeType: string;
}

// Send one or more photos of the SAME product label to the AI backend, which
// reads the nutrition table and returns macros per 100 g/ml and per serving.
export async function extractNutritionFromLabels(
  shots: LabelShot[],
): Promise<{ product: ExtractedNutrition; demo: boolean }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/extract-nutrition-label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ images: shots }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw mapApiError(res.status, err);
  }

  return res.json();
}
