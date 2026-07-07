import * as Location from 'expo-location';

// Baseline when we don't know the user's weight (~2 L guideline).
const BASE_ML = 2000;

export interface CurrentTemp {
  tempC?: number;
  source: 'weather' | 'default';
}

// Suggested daily water intake. Personalised by body weight when known
// (~33 ml/kg), otherwise a flat baseline; nudged up in the heat. This is a
// friendly guideline, not medical advice.
export function waterGoalMl(tempC?: number, weightKg?: number): number {
  let ml = weightKg && weightKg > 0 ? weightKg * 33 : BASE_ML;
  if (typeof tempC === 'number' && tempC > 22) {
    ml += Math.min(tempC - 22, 20) * 40; // up to +800 ml in extreme heat
  }
  return Math.round(ml / 100) * 100;
}

// Cache the weather read for a while (temperature barely moves within 30 min).
let cache: { at: number; value: CurrentTemp } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

// Device location + Open-Meteo (free, no API key) → current temperature.
export async function getCurrentTemp(): Promise<CurrentTemp> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.value;
  const value = await readTemp();
  if (value.source === 'weather') cache = { at: Date.now(), value };
  return value;
}

async function readTemp(): Promise<CurrentTemp> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!granted) return { source: 'default' };

    const loc =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!loc) return { source: 'default' };

    const { latitude, longitude } = loc.coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );
    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    if (typeof tempC !== 'number') return { source: 'default' };
    return { tempC, source: 'weather' };
  } catch {
    return { source: 'default' };
  }
}
