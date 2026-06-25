import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, MealEntry, MealPlan } from '../types';
import { SEED_STATE } from '../data/seed';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Stored data may have slot values as bare recipe ID strings (pre-MealEntry era).
function migrateMealPlan(raw: any): MealPlan {
  if (!raw || typeof raw !== 'object') return {};
  const out: MealPlan = {};
  for (const day of Object.keys(raw) as any[]) {
    const dayRaw = raw[day];
    if (!dayRaw || typeof dayRaw !== 'object') continue;
    out[day as keyof MealPlan] = {};
    for (const slot of Object.keys(dayRaw) as any[]) {
      const v = dayRaw[slot];
      if (v == null) { (out[day as keyof MealPlan] as any)[slot] = null; }
      else if (typeof v === 'string') { (out[day as keyof MealPlan] as any)[slot] = { type: 'recipe', recipeId: v } satisfies MealEntry; }
      else { (out[day as keyof MealPlan] as any)[slot] = v as MealEntry; }
    }
  }
  return out;
}

const CACHE_PREFIX = '@yumshare/state-v3/';

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

// Fill in any AppState fields a stored blob predates, and keep seed image URLs
// fresh for the built-in recipes.
function normalize(parsed: Partial<AppState>): AppState {
  const mergedRecipes = parsed.recipes?.length
    ? parsed.recipes.map((r) => {
        const seed = SEED_STATE.recipes.find((s) => s.id === r.id);
        return seed ? { ...r, imageUrl: r.imageUrl ?? seed.imageUrl } : r;
      })
    : SEED_STATE.recipes;
  return { ...SEED_STATE, ...parsed, recipes: mergedRecipes, mealPlan: migrateMealPlan(parsed.mealPlan) };
}

// Load a user's state: prefer Supabase (source of truth across devices), fall
// back to the local cache, then to the seed for brand-new accounts.
export async function loadState(userId: string): Promise<AppState> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data?.data) {
        const state = normalize(data.data as Partial<AppState>);
        AsyncStorage.setItem(cacheKey(userId), JSON.stringify(state)).catch(() => {});
        return state;
      }
      // No row yet → fresh account starts from the seed.
      return SEED_STATE;
    } catch {
      // fall through to cache on network/auth error
    }
  }

  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (raw) return normalize(JSON.parse(raw) as Partial<AppState>);
  } catch {
    /* ignore */
  }
  return SEED_STATE;
}

export async function saveState(userId: string, state: AppState): Promise<void> {
  AsyncStorage.setItem(cacheKey(userId), JSON.stringify(state)).catch(() => {});
  if (!isSupabaseConfigured) return;
  try {
    await supabase
      .from('app_state')
      .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() });
  } catch {
    /* offline — cache already written, will re-sync on next save */
  }
}

export async function clearCache(userId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(userId));
}
