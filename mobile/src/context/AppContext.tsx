import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SEED_STATE } from '../data/seed';
import { loadState, saveState } from '../storage/persist';
import {
  AppState,
  CookbookCover,
  DayKey,
  GroceryItem,
  MealPlan,
  MealSlot,
  PantryItem,
  Receipt,
  Recipe,
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
  clearCheckedGrocery: () => void;
  addRecipeToGrocery: (recipeId: string) => void;
  addWeekToGrocery: () => void;
  setMealPlan: (plan: MealPlan) => void;
  assignMeal: (day: DayKey, slot: MealSlot, recipeId: string | null) => void;
  removeMeal: (day: DayKey, slot: MealSlot) => void;
  toggleMade: (recipeId: string) => void;
  toggleIngredient: (recipeId: string, index: number) => void;
  setHasOnboarded: (value: boolean) => void;
  setCookbookCover: (tag: string, cover: CookbookCover | null) => void;
  createCookbook: (title: string) => string;
  deleteCookbook: (id: string) => void;
  toggleRecipeInCookbook: (cookbookId: string, recipeId: string) => void;
  getRecipe: (id: string) => Recipe | undefined;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (receipt: Receipt) => void;
  removeReceipt: (id: string) => void;
  getReceipt: (id: string) => Receipt | undefined;
  addPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  getPantryItem: (id: string) => PantryItem | undefined;
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

  // Debounced persistence to Supabase (+ local cache) on every change.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveState(userId, state), 600);
    return () => clearTimeout(t);
  }, [state, ready, userId]);

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

  const clearCheckedGrocery = useCallback(() => {
    setState((s) => ({ ...s, grocery: s.grocery.filter((g) => !g.checked) }));
    showToast('Cleared the basket');
  }, [showToast]);

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
            if (!ex.merged) {
              ex.a = `${ex.a} + ${ing.a}`;
              ex.merged = true;
            }
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

  const addWeekToGrocery = useCallback(() => {
    setState((s) => {
      const list = [...s.grocery];
      const ids: string[] = [];
      Object.values(s.mealPlan).forEach((day) => {
        if (!day) return;
        (['Breakfast', 'Lunch', 'Dinner'] as MealSlot[]).forEach((slot) => {
          const rid = day[slot];
          if (rid) ids.push(rid);
        });
      });

      let n = 0;
      ids.forEach((id) => {
        const rec = s.recipes.find((r) => r.id === id);
        if (!rec) return;
        rec.ingredients.forEach((ing) => {
          const ex = list.find((g) => g.n.toLowerCase() === ing.n.toLowerCase());
          if (ex) {
            ex.checked = false;
          } else {
            list.push({
              id: `gw${Date.now()}_${n++}`,
              a: ing.a,
              n: ing.n,
              aisle: ing.aisle,
              recipe: rec.title,
              checked: false,
            });
          }
        });
      });
      return { ...s, grocery: list };
    });
    showToast("Week's ingredients added");
  }, [showToast]);

  const setMealPlan = useCallback((plan: MealPlan) => {
    setState((s) => ({ ...s, mealPlan: plan }));
  }, []);

  const assignMeal = useCallback((day: DayKey, slot: MealSlot, recipeId: string | null) => {
    setState((s) => {
      const mp = { ...s.mealPlan };
      mp[day] = { ...mp[day], [slot]: recipeId };
      return { ...s, mealPlan: mp };
    });
  }, []);

  const removeMeal = useCallback((day: DayKey, slot: MealSlot) => {
    setState((s) => {
      const mp = { ...s.mealPlan };
      if (mp[day]) mp[day] = { ...mp[day], [slot]: null };
      return { ...s, mealPlan: mp };
    });
  }, []);

  const toggleMade = useCallback(
    (recipeId: string) => {
      setState((s) => {
        const made = { ...s.made };
        const was = !!made[recipeId];
        made[recipeId] = !was;
        return { ...s, made };
      });
      const was = !!state.made[recipeId];
      showToast(was ? 'Removed from made' : 'Marked as made');
    },
    [state.made, showToast],
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
      clearCheckedGrocery,
      addRecipeToGrocery,
      addWeekToGrocery,
      setMealPlan,
      assignMeal,
      removeMeal,
      toggleMade,
      toggleIngredient,
      setHasOnboarded,
      setCookbookCover,
      createCookbook,
      deleteCookbook,
      toggleRecipeInCookbook,
      getRecipe,
      addReceipt,
      updateReceipt,
      removeReceipt,
      getReceipt,
      addPantryItem,
      removePantryItem,
      getPantryItem,
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
      clearCheckedGrocery,
      addRecipeToGrocery,
      addWeekToGrocery,
      setMealPlan,
      assignMeal,
      removeMeal,
      toggleMade,
      toggleIngredient,
      setHasOnboarded,
      setCookbookCover,
      createCookbook,
      deleteCookbook,
      toggleRecipeInCookbook,
      getRecipe,
      addReceipt,
      updateReceipt,
      removeReceipt,
      getReceipt,
      addPantryItem,
      removePantryItem,
      getPantryItem,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
