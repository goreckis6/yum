import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, MealEntry, MealPlan } from '../types';
import { SEED_STATE } from '../data/seed';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// The plan is now keyed by ISO date ("YYYY-MM-DD"). Keep only date-keyed days;
// legacy weekday-template keys (Mon…Sun) are dropped on migration. Also migrate
// bare recipe-ID slot values (pre-MealEntry era) to MealEntry.
function migrateMealPlan(raw: any): MealPlan {
  if (!raw || typeof raw !== 'object') return {};
  const isDate = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  const out: MealPlan = {};
  for (const day of Object.keys(raw)) {
    if (!isDate(day)) continue; // drop legacy Mon…Sun entries
    const dayRaw = raw[day];
    if (!dayRaw || typeof dayRaw !== 'object') continue;
    out[day] = {};
    for (const slot of Object.keys(dayRaw) as any[]) {
      const v = dayRaw[slot];
      if (v == null) { (out[day] as any)[slot] = null; }
      else if (typeof v === 'string') { (out[day] as any)[slot] = { type: 'recipe', recipeId: v } satisfies MealEntry; }
      else { (out[day] as any)[slot] = v as MealEntry; }
    }
  }
  return out;
}

const CACHE_PREFIX = '@yumshare/state-v3/';

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

// The server updated_at we last saw for each user — the baseline for optimistic
// concurrency. Set on load and after every successful save so the next save can
// tell whether another device wrote in the meantime.
const lastSyncedAt = new Map<string, string>();

// Result of a save. When another device saved newer data since we loaded, the
// save is rejected server-side and the caller gets that newer state to adopt
// (rather than silently clobbering it).
export type SaveResult = { conflict: boolean; state?: AppState };

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
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data?.data) {
        // Remember the server timestamp as our concurrency baseline.
        if (data.updated_at) lastSyncedAt.set(userId, data.updated_at as string);
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

export async function saveState(userId: string, state: AppState): Promise<SaveResult> {
  AsyncStorage.setItem(cacheKey(userId), JSON.stringify(state)).catch(() => {});
  if (!isSupabaseConfigured) return { conflict: false };
  try {
    // Optimistic-concurrency save: only overwrite if the server hasn't advanced
    // past our baseline. On conflict the server returns its newer state.
    const base = lastSyncedAt.get(userId) ?? null;
    const { data, error } = await supabase.rpc('save_app_state', { p_data: state, p_base: base });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.updated_at) lastSyncedAt.set(userId, row.updated_at as string);
    if (row?.conflict) {
      const remote = normalize(row.data as Partial<AppState>);
      AsyncStorage.setItem(cacheKey(userId), JSON.stringify(remote)).catch(() => {});
      return { conflict: true, state: remote };
    }
    return { conflict: false };
  } catch {
    // RPC not deployed yet (schema not re-run) or offline — fall back to the
    // previous best-effort upsert so persistence still works. Local cache is
    // already written above.
    try {
      const nowIso = new Date().toISOString();
      await supabase.from('app_state').upsert({ user_id: userId, data: state, updated_at: nowIso });
      lastSyncedAt.set(userId, nowIso);
    } catch {
      /* offline — cache already written, will re-sync on next save */
    }
    return { conflict: false };
  }
}

export async function clearCache(userId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(userId));
}
