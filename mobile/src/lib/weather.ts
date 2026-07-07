import * as Location from 'expo-location';

// A general baseline (~2 L); nudged up in the heat. We don't have body weight,
// so this is a friendly guideline, not medical advice.
const BASE_ML = 2000;

export interface WaterRecommendation {
  recommendedMl: number;
  tempC?: number;
  source: 'weather' | 'default';
}

function recommend(tempC?: number): number {
  let ml = BASE_ML;
  if (typeof tempC === 'number' && tempC > 22) {
    ml += Math.min(tempC - 22, 20) * 40; // up to +800 ml in extreme heat
  }
  return Math.round(ml / 100) * 100;
}

// Cache the result for a while so we don't hit location/weather on every screen
// mount (temperature barely moves within half an hour).
let cache: { at: number; value: WaterRecommendation } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

// Uses the device location + Open-Meteo (free, no API key) to get the current
// temperature and turn it into a suggested daily water intake. Falls back to a
// plain baseline if location/weather is unavailable.
export async function getWaterRecommendation(): Promise<WaterRecommendation> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.value;
  const result = await computeRecommendation();
  // Only cache a real weather reading; keep retrying while we're on the fallback.
  if (result.source === 'weather') cache = { at: Date.now(), value: result };
  return result;
}

async function computeRecommendation(): Promise<WaterRecommendation> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!granted) return { recommendedMl: recommend(), source: 'default' };

    const loc =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!loc) return { recommendedMl: recommend(), source: 'default' };

    const { latitude, longitude } = loc.coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );
    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    if (typeof tempC !== 'number') return { recommendedMl: recommend(), source: 'default' };

    return { recommendedMl: recommend(tempC), tempC, source: 'weather' };
  } catch {
    return { recommendedMl: recommend(), source: 'default' };
  }
}
