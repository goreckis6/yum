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

export async function lookupBarcode(code: string): Promise<FoodProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    code,
  )}.json?fields=product_name,brands,image_front_small_url,serving_size,nutriments`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'YumiShare/1.0 (recipe app)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const nut = p.nutriments ?? {};
    return {
      code,
      name: p.product_name || 'Unknown product',
      brand: p.brands || '',
      imageUrl: p.image_front_small_url || undefined,
      servingSize: p.serving_size || undefined,
      kcal: n(nut['energy-kcal_100g']),
      p: n(nut.proteins_100g),
      c: n(nut.carbohydrates_100g),
      f: n(nut.fat_100g),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
