// Open Food Facts product lookup by barcode (EAN/UPC). Free, no API key.
export interface FoodProduct {
  code: string;
  name: string;
  brand: string;
  imageUrl?: string;
  servingSize?: string;
  // per 100 g/ml
  kcal: number;
  p: number;
  c: number;
  f: number;
}

const n = (v: unknown) => {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? Math.round((x as number) * 10) / 10 : 0;
};

async function offFetch(code: string, fields: string, timeoutMs: number): Promise<any> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'YumiShare/1.0 (recipe app)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns product info WITHOUT image — fast. Image comes via lookupBarcodeImage(). */
export async function lookupBarcode(code: string): Promise<FoodProduct | null> {
  const product = await offFetch(code, 'product_name,brands,serving_size,nutriments', 10000);
  if (!product) return null;
  const nut = product.nutriments ?? {};
  return {
    code,
    name: product.product_name || 'Unknown product',
    brand: product.brands || '',
    imageUrl: undefined,
    servingSize: product.serving_size || undefined,
    kcal: n(nut['energy-kcal_100g']),
    p: n(nut.proteins_100g),
    c: n(nut.carbohydrates_100g),
    f: n(nut.fat_100g),
  };
}

/** Fetch just the image URL for a known barcode (fire-and-forget background use). */
export async function lookupBarcodeImage(code: string): Promise<string | undefined> {
  const product = await offFetch(code, 'image_front_small_url', 8000);
  return product?.image_front_small_url || undefined;
}

export interface OFFSearchResult {
  code: string;
  name: string;
  brand: string;
  imageUrl?: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<OFFSearchResult[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=10` +
    `&fields=code,product_name,brands,image_front_small_url,nutriments`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'YumiShare/1.0 (recipe app)' },
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const products: any[] = data.products ?? [];
    return products
      .filter((p) => p.product_name)
      .map((p) => ({
        code: p.code ?? '',
        name: p.product_name,
        brand: p.brands || '',
        imageUrl: p.image_front_small_url || undefined,
        kcal: n(p.nutriments?.['energy-kcal_100g']),
        p: n(p.nutriments?.proteins_100g),
        c: n(p.nutriments?.carbohydrates_100g),
        f: n(p.nutriments?.fat_100g),
      }));
  } catch {
    return [];
  }
}
