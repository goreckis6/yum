import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sumAmounts } from '../utils/amounts';
import { SEED_STATE } from '../data/seed';
import { loadState, saveState } from '../storage/persist';
import { fetchCredits } from '../api/recipes';
import { identify, track } from '../lib/analytics';
import {
  Aisle,
  ALL_SLOTS,
  AppState,
  CookbookCover,
  DayKey,
  GroceryItem,
  MealEntry,
  MealPlan,
  MealReminderOverride,
  MealSlot,
  PantryItem,
  Receipt,
  Recipe,
  UnitSystem,
} from '../types';

interface ToastState {
  visible: boolean;
  message: string;
}

interface AppContextValue extends AppState {
  ready: boolean;
  toast: ToastState;
  showToast: (message: string) => void;
  addRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  updateRecipeTags: (id: string, tags: string[]) => void;
  updateRecipe: (recipe: Recipe) => void;
  toggleFavorite: (id: string) => void;
  updateRecipes: (recipes: Recipe[]) => void;
  toggleGrocery: (id: string) => void;
  toggleAllGrocery: (checked: boolean) => void;
  removeGrocery: (id: string) => void;
  clearCheckedGrocery: () => void;
  addRecipeToGrocery: (recipeId: string) => void;
  addIngredientsToGrocery: (
    recipeTitle: string,
    ingredients: { a: string; n: string; aisle: Aisle }[],
  ) => void;
  addPantryToGrocery: (pantryId: string) => void;
  addGroceryItem: (item: GroceryItem) => void;
  addWeekToGrocery: () => void;
  setMealPlan: (plan: MealPlan) => void;
  assignMeal: (date: string, slot: MealSlot, entry: MealEntry) => void;
  removeMeal: (date: string, slot: MealSlot) => void;
  copyDayMeals: (from: string, to: string) => number;
  toggleMade: (recipeId: string) => void;
  logCooked: (recipeId: string) => void;
  toggleIngredient: (recipeId: string, index: number) => void;
  setHasOnboarded: (value: boolean) => void;
  setCookbookCover: (tag: string, cover: CookbookCover | null) => void;
  createCookbook: (title: string) => string;
  deleteCookbook: (id: string) => void;
  renameCookbook: (id: string, title: string) => void;
  toggleRecipeInCookbook: (cookbookId: string, recipeId: string) => void;
  getRecipe: (id: string) => Recipe | undefined;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (receipt: Receipt) => void;
  removeReceipt: (id: string) => void;
  getReceipt: (id: string) => Receipt | undefined;
  addPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  getPantryItem: (id: string) => PantryItem | undefined;
  setUnitSystem: (u: UnitSystem) => void;
  spendCredit: () => void;
  grantCredits: (n: number) => void;
  setCredits: (n: number) => void;
  setMealReminders: (patch: Partial<AppState['mealReminders']>) => void;
  setMealReminderOverride: (date: string, slot: MealSlot, override: MealReminderOverride | null) => void;
  addWater: (date: string, deltaMl: number) => void;
  setWeight: (kg: number) => void;
  setMealPlanWidgetOrder: (order: string[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(SEED_STATE);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });

  // Load the signed-in user's state; reload when the account changes.
  useEffect(() => {
    let active = true;
    setReady(false);
    loadState(userId).then((loaded) => {
      if (!active) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // Debounced persistence to Supabase (+ local cache) on every change. If
  // another device saved newer data since we loaded, the save is rejected and
  // we adopt that newer state instead of clobbering it.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await saveState(userId, state);
      if (!cancelled && res?.conflict && res.state) setState(res.state);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [state, ready, userId]);

  // Tie analytics events to this signed-in user (once per userId).
  useEffect(() => {
    if (userId) {
      identify(userId);
      track('signed_in');
    }
  }, [userId]);

  // Sync import credits from the server (source of truth). null = premium.
  useEffect(() => {
    let active = true;
    fetchCredits()
      .then(({ credits }) => {
        if (active && typeof credits === 'number') setState((s) => ({ ...s, credits }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2300);
  }, []);

  const getRecipe = useCallback(
    (id: string) => state.recipes.find((r) => r.id === id),
    [state.recipes],
  );

  const addRecipe = useCallback((recipe: Recipe) => {
    setState((s) => ({ ...s, recipes: [recipe, ...s.recipes] }));
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      recipes: s.recipes.filter((r) => r.id !== id),
      grocery: s.grocery.filter((g) => g.recipe !== s.recipes.find((r) => r.id === id)?.title),
    }));
  }, []);

  const updateRecipes = useCallback((recipes: Recipe[]) => {
    setState((s) => ({ ...s, recipes }));
  }, []);

  const updateRecipe = useCallback((recipe: Recipe) => {
    setState((s) => ({
      ...s,
      recipes: s.recipes.map((r) => (r.id === recipe.id ? recipe : r)),
    }));
  }, []);

  const updateRecipeTags = useCallback((id: string, tags: string[]) => {
    setState((s) => ({
      ...s,
      recipes: s.recipes.map((r) => (r.id === id ? { ...r, tags } : r)),
    }));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      favorites: { ...s.favorites, [id]: !s.favorites[id] },
    }));
  }, []);

  const toggleGrocery = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      grocery: s.grocery.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)),
    }));
  }, []);

  const toggleAllGrocery = useCallback((checked: boolean) => {
    setState((s) => ({
      ...s,
      grocery: s.grocery.map((g) => ({ ...g, checked })),
    }));
  }, []);

  const removeGrocery = useCallback((id: string) => {
    setState((s) => ({ ...s, grocery: s.grocery.filter((g) => g.id !== id) }));
  }, []);

  const addGroceryItem = useCallback((item: GroceryItem) => {
    setState((s) => {
      if (s.grocery.find((g) => g.n.toLowerCase() === item.n.toLowerCase())) return s;
      return { ...s, grocery: [...s.grocery, item] };
    });
  }, []);

  const clearCheckedGrocery = useCallback(() => {
    setState((s) => ({ ...s, grocery: s.grocery.filter((g) => !g.checked) }));
    showToast('Cleared the basket');
  }, [showToast]);

  const addPantryToGrocery = useCallback(
    (pantryId: string) => {
      const item = state.pantry?.find((p) => p.id === pantryId);
      if (!item) return;
      setState((s) => {
        const existing = s.grocery.find((g) => g.n.toLowerCase() === item.name.toLowerCase());
        if (existing) return s;
        return {
          ...s,
          grocery: [
            ...s.grocery,
            {
              id: `gp${Date.now()}`,
              a: item.servingSize || '1 szt.',
              n: item.name,
              aisle: 'Pantry' as const,
              recipe: item.brand || 'Spiżarnia',
              checked: false,
            },
          ],
        };
      });
      showToast('Dodano do listy zakupów');
    },
    [state.pantry, showToast],
  );

  const addRecipeToGrocery = useCallback(
    (recipeId: string) => {
      const recipe = state.recipes.find((r) => r.id === recipeId);
      if (!recipe) return;

      setState((s) => {
        const list = [...s.grocery];
        let added = 0;
        recipe.ingredients.forEach((ing) => {
          const ex = list.find((g) => g.n.toLowerCase() === ing.n.toLowerCase());
          if (ex) {
            ex.a = sumAmounts(ex.a, ing.a);
            ex.merged = true;
            ex.checked = false;
          } else {
            list.push({
              id: `g${Date.now()}_${added++}`,
              a: ing.a,
              n: ing.n,
              aisle: ing.aisle,
              recipe: recipe.title,
              checked: false,
            });
          }
        });
        return { ...s, grocery: list };
      });
      showToast('Added to grocery list');
    },
    [state.recipes, showToast],
  );

  // Add an explicit, already-scaled subset of ingredients (used by the
  // "Add to groceries" sheet where the user picks items and servings).
  const addIngredientsToGrocery = useCallback(
    (recipeTitle: string, ingredients: { a: string; n: string; aisle: Aisle }[]) => {
      setState((s) => {
        const list = [...s.grocery];
        let added = 0;
        ingredients.forEach((ing) => {
          const ex = list.find((g) => g.n.toLowerCase() === ing.n.toLowerCase());
          if (ex) {
            ex.a = sumAmounts(ex.a, ing.a);
            ex.merged = true;
            ex.checked = false;
          } else {
            list.push({
              id: `g${Date.now()}_${added++}`,
              a: ing.a,
              n: ing.n,
              aisle: ing.aisle,
              recipe: recipeTitle,
              checked: false,
            });
          }
        });
        return { ...s, grocery: list };
      });
      showToast('Added to grocery list');
    },
    [showToast],
  );

  const addWeekToGrocery = useCallback(() => {
    setState((s) => {
      const list = [...s.grocery];
      let n = 0;
      Object.values(s.mealPlan).forEach((day) => {
        if (!day) return;
        (['Breakfast', 'SecondBreakfast', 'Lunch', 'Dinner', 'Snack', 'Supper'] as MealSlot[]).forEach((slot) => {
          const entry = day[slot];
          if (!entry || entry.type !== 'recipe') return;
          const rec = s.recipes.find((r) => r.id === entry.recipeId);
          if (!rec) return;
          rec.ingredients.forEach((ing) => {
            const ex = list.find((g) => g.n.toLowerCase() === ing.n.toLowerCase());
            if (ex) { ex.a = sumAmounts(ex.a, ing.a); ex.merged = true; ex.checked = false; }
            else {
              list.push({
                id: `gw${Date.now()}_${n++}`,
                a: ing.a, n: ing.n, aisle: ing.aisle,
                recipe: rec.title, checked: false,
              });
            }
          });
        });
      });
      return { ...s, grocery: list };
    });
    showToast("Week's ingredients added");
  }, [showToast]);

  const setMealPlan = useCallback((plan: MealPlan) => {
    setState((s) => ({ ...s, mealPlan: plan }));
  }, []);

  const assignMeal = useCallback((date: string, slot: MealSlot, entry: MealEntry) => {
    track('meal_planned', { slot, entryType: entry.type });
    setState((s) => {
      const mp = { ...s.mealPlan };
      mp[date] = { ...mp[date], [slot]: entry };
      return { ...s, mealPlan: mp };
    });
  }, []);

  const removeMeal = useCallback((date: string, slot: MealSlot) => {
    setState((s) => {
      const mp = { ...s.mealPlan };
      if (mp[date]) mp[date] = { ...mp[date], [slot]: null };
      // Drop any per-meal reminder override along with the meal itself.
      const overrides = { ...(s.mealReminderOverrides ?? {}) };
      delete overrides[`${date}|${slot}`];
      return { ...s, mealPlan: mp, mealReminderOverrides: overrides };
    });
  }, []);

  // Copy every filled slot from one day onto another (e.g. "duplicate to
  // tomorrow"). Filled source slots overwrite the target's same slot; the
  // target's other slots are left untouched. Returns how many meals were copied
  // so the caller can toast accordingly.
  const copyDayMeals = useCallback((from: string, to: string): number => {
    if (from === to) return 0;
    const src = state.mealPlan[from];
    const filled = src ? ALL_SLOTS.filter((slot) => src[slot]) : [];
    if (filled.length === 0) return 0;
    setState((s) => {
      const srcDay = s.mealPlan[from];
      if (!srcDay) return s;
      const dayCopy = { ...(s.mealPlan[to] ?? {}) };
      for (const slot of ALL_SLOTS) {
        if (srcDay[slot]) dayCopy[slot] = srcDay[slot];
      }
      return { ...s, mealPlan: { ...s.mealPlan, [to]: dayCopy } };
    });
    track('meals_copied', { count: filled.length });
    return filled.length;
  }, [state.mealPlan]);

  const wasCooked = useCallback(
    (recipeId: string) => !!state.made[recipeId] || (state.madeHistory?.[recipeId]?.length ?? 0) > 0,
    [state.made, state.madeHistory],
  );

  // Append a cook event (used when finishing Cooking Mode) — always logs a new
  // timestamp, so the history reflects every time the recipe was actually made.
  const logCooked = useCallback((recipeId: string) => {
    track('recipe_cooked');
    setState((s) => {
      const madeHistory = { ...s.madeHistory, [recipeId]: [...(s.madeHistory[recipeId] ?? []), Date.now()] };
      return { ...s, made: { ...s.made, [recipeId]: true }, madeHistory };
    });
  }, []);

  const toggleMade = useCallback(
    (recipeId: string) => {
      const was = wasCooked(recipeId);
      setState((s) => {
        const made = { ...s.made };
        const madeHistory = { ...s.madeHistory };
        if (was) {
          // Un-mark: clear the flag and the whole history.
          made[recipeId] = false;
          delete madeHistory[recipeId];
        } else {
          made[recipeId] = true;
          madeHistory[recipeId] = [...(madeHistory[recipeId] ?? []), Date.now()];
        }
        return { ...s, made, madeHistory };
      });
      showToast(was ? 'Removed from made' : 'Marked as made');
    },
    [wasCooked, showToast],
  );

  const toggleIngredient = useCallback((recipeId: string, index: number) => {
    const key = `${recipeId}:${index}`;
    setState((s) => {
      const ingChecked = { ...s.ingChecked };
      ingChecked[key] = !ingChecked[key];
      return { ...s, ingChecked };
    });
  }, []);

  const setHasOnboarded = useCallback((value: boolean) => {
    setState((s) => ({ ...s, hasOnboarded: value }));
  }, []);

  const setCookbookCover = useCallback((tag: string, cover: CookbookCover | null) => {
    setState((s) => {
      const covers = { ...s.cookbookCovers };
      if (cover) covers[tag] = cover;
      else delete covers[tag];
      return { ...s, cookbookCovers: covers };
    });
  }, []);

  const createCookbook = useCallback((title: string) => {
    const id = `cbk${Date.now()}`;
    setState((s) => ({
      ...s,
      customCookbooks: [...s.customCookbooks, { id, title, recipeIds: [] }],
    }));
    return id;
  }, []);

  const deleteCookbook = useCallback((id: string) => {
    setState((s) => {
      const covers = { ...s.cookbookCovers };
      delete covers[id];
      return {
        ...s,
        customCookbooks: s.customCookbooks.filter((cb) => cb.id !== id),
        cookbookCovers: covers,
      };
    });
  }, []);

  const renameCookbook = useCallback((id: string, title: string) => {
    const next = title.trim();
    if (!next) return;
    setState((s) => ({
      ...s,
      customCookbooks: s.customCookbooks.map((cb) => (cb.id === id ? { ...cb, title: next } : cb)),
    }));
  }, []);

  const getReceipt = useCallback(
    (id: string) => state.receipts?.find((r) => r.id === id),
    [state.receipts],
  );

  const addReceipt = useCallback((receipt: Receipt) => {
    setState((s) => ({ ...s, receipts: [receipt, ...(s.receipts ?? [])] }));
  }, []);

  const updateReceipt = useCallback((receipt: Receipt) => {
    setState((s) => ({
      ...s,
      receipts: (s.receipts ?? []).map((r) => (r.id === receipt.id ? receipt : r)),
    }));
  }, []);

  const removeReceipt = useCallback((id: string) => {
    setState((s) => ({ ...s, receipts: (s.receipts ?? []).filter((r) => r.id !== id) }));
  }, []);

  const getPantryItem = useCallback(
    (id: string) => state.pantry?.find((p) => p.id === id),
    [state.pantry],
  );

  const addPantryItem = useCallback((item: PantryItem) => {
    setState((s) => ({ ...s, pantry: [item, ...(s.pantry ?? [])] }));
  }, []);

  const removePantryItem = useCallback((id: string) => {
    setState((s) => ({ ...s, pantry: (s.pantry ?? []).filter((p) => p.id !== id) }));
  }, []);

  const setUnitSystem = useCallback((u: UnitSystem) => {
    setState((s) => ({ ...s, unitSystem: u }));
  }, []);

  // Spend one import credit (floored at 0). Called only on a SUCCESSFUL recipe
  // extraction — a "no recipe found" fallback must not call this.
  const spendCredit = useCallback(() => {
    setState((s) => {
      const creditsLeft = Math.max(0, (s.credits ?? 0) - 1);
      track('import_credit_spent', { creditsLeft });
      return { ...s, credits: creditsLeft };
    });
  }, []);

  const grantCredits = useCallback((n: number) => {
    setState((s) => ({ ...s, credits: Math.max(0, (s.credits ?? 0) + n) }));
  }, []);

  // Set the balance to the server's authoritative value (credits are enforced
  // server-side; the client just mirrors what the backend returns).
  const setCredits = useCallback((n: number) => {
    setState((s) => ({ ...s, credits: Math.max(0, n) }));
  }, []);

  const setMealReminders = useCallback((patch: Partial<AppState['mealReminders']>) => {
    setState((s) => ({ ...s, mealReminders: { ...s.mealReminders, ...patch } }));
  }, []);

  // Per-meal reminder override — pass `null` to reset back to the default.
  const setMealReminderOverride = useCallback(
    (date: string, slot: MealSlot, override: MealReminderOverride | null) => {
      setState((s) => {
        const overrides = { ...(s.mealReminderOverrides ?? {}) };
        const key = `${date}|${slot}`;
        if (override) overrides[key] = override;
        else delete overrides[key];
        return { ...s, mealReminderOverrides: overrides };
      });
    },
    [],
  );

  const addWater = useCallback((date: string, deltaMl: number) => {
    setState((s) => {
      const next = Math.max(0, (s.water?.[date] ?? 0) + deltaMl);
      return { ...s, water: { ...s.water, [date]: next } };
    });
  }, []);

  const setWeight = useCallback((kg: number) => {
    setState((s) => ({ ...s, weightKg: Math.max(0, Math.min(400, Math.round(kg))) }));
  }, []);

  const setMealPlanWidgetOrder = useCallback((order: string[]) => {
    setState((s) => ({ ...s, mealPlanWidgetOrder: order }));
  }, []);

  const toggleRecipeInCookbook = useCallback((cookbookId: string, recipeId: string) => {
    setState((s) => ({
      ...s,
      customCookbooks: s.customCookbooks.map((cb) => {
        if (cb.id !== cookbookId) return cb;
        const has = cb.recipeIds.includes(recipeId);
        return {
          ...cb,
          recipeIds: has ? cb.recipeIds.filter((r) => r !== recipeId) : [...cb.recipeIds, recipeId],
        };
      }),
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      ready,
      toast,
      showToast,
      addRecipe,
      removeRecipe,
      updateRecipes,
      updateRecipeTags,
      updateRecipe,
      toggleFavorite,
      toggleGrocery,
      toggleAllGrocery,
      removeGrocery,
      clearCheckedGrocery,
      addRecipeToGrocery,
      addIngredientsToGrocery,
      addPantryToGrocery,
      addGroceryItem,
      addWeekToGrocery,
      setMealPlan,
      assignMeal,
      removeMeal,
      copyDayMeals,
      toggleMade,
      logCooked,
      toggleIngredient,
      setHasOnboarded,
      setCookbookCover,
      createCookbook,
      deleteCookbook,
      renameCookbook,
      toggleRecipeInCookbook,
      getRecipe,
      addReceipt,
      updateReceipt,
      removeReceipt,
      getReceipt,
      addPantryItem,
      removePantryItem,
      getPantryItem,
      setUnitSystem,
      spendCredit,
      grantCredits,
      setCredits,
      setMealReminders,
      setMealReminderOverride,
      addWater,
      setWeight,
      setMealPlanWidgetOrder,
    }),
    [
      state,
      ready,
      toast,
      showToast,
      addRecipe,
      removeRecipe,
      updateRecipes,
      updateRecipeTags,
      updateRecipe,
      toggleFavorite,
      toggleGrocery,
      toggleAllGrocery,
      removeGrocery,
      clearCheckedGrocery,
      addRecipeToGrocery,
      addIngredientsToGrocery,
      addPantryToGrocery,
      addGroceryItem,
      addWeekToGrocery,
      setMealPlan,
      assignMeal,
      removeMeal,
      copyDayMeals,
      toggleMade,
      logCooked,
      toggleIngredient,
      setHasOnboarded,
      setCookbookCover,
      createCookbook,
      deleteCookbook,
      renameCookbook,
      toggleRecipeInCookbook,
      getRecipe,
      addReceipt,
      updateReceipt,
      removeReceipt,
      getReceipt,
      addPantryItem,
      removePantryItem,
      getPantryItem,
      setUnitSystem,
      spendCredit,
      grantCredits,
      setCredits,
      setMealReminders,
      setMealReminderOverride,
      addWater,
      setWeight,
      setMealPlanWidgetOrder,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
