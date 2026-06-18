export type Aisle =
  | 'Produce'
  | 'Meat & Seafood'
  | 'Dairy & Eggs'
  | 'Bakery'
  | 'Pantry'
  | 'Frozen';

export interface Ingredient {
  a: string;
  n: string;
  aisle: Aisle;
}

export interface Recipe {
  id: string;
  title: string;
  time: number;
  rating: string;
  servings: number;
  app: string;
  handle: string;
  tint: string;
  sourceTint: string;
  imageUrl?: string;
  cover?: string; // gradient preset id for a text-only cover (used when no imageUrl)
  tags: string[];
  kcal: number;
  p: number;
  c: number;
  f: number;
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
}

export interface GroceryItem {
  id: string;
  a: string;
  n: string;
  aisle: Aisle;
  recipe: string;
  checked: boolean;
  merged?: boolean;
}

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner';
export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type MealPlan = Partial<Record<DayKey, Partial<Record<MealSlot, string | null>>>>;

export interface AppState {
  recipes: Recipe[];
  grocery: GroceryItem[];
  mealPlan: MealPlan;
  made: Record<string, boolean>;
  ingChecked: Record<string, boolean>;
  favorites: Record<string, boolean>;
  hasOnboarded: boolean;
  cookbookCovers: Record<string, CookbookCover>;
  customCookbooks: CustomCookbook[];
}

export interface CookbookCover {
  imageUrl?: string;
  cover?: string; // gradient preset id (text cover)
}

export interface CustomCookbook {
  id: string;
  title: string;
  recipeIds: string[];
}

export type HomeTab = 'organize' | 'plan' | 'cook' | 'track';
export type DetailTab = 'ingredients' | 'steps' | 'nutrition';
export type FilterChip = 'All' | 'Favorites' | 'Quick' | 'Dinner' | 'Breakfast' | 'Lunch' | 'Vegetarian' | 'High-protein';
export const RECIPE_TAGS = ['Quick', 'Dinner', 'Breakfast', 'Lunch', 'Vegetarian', 'High-protein'] as const;
export type RecipeTag = typeof RECIPE_TAGS[number];

export const TAG_ICON: Record<string, string> = {
  Favorites: '♥',
  Quick: '⚡',
  Breakfast: '🍳',
  Lunch: '🥪',
  Dinner: '🍲',
  Vegetarian: '🌱',
  'High-protein': '💪',
};
