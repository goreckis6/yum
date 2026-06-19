export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Home: undefined;
  RecipeDetail: { id: string };
  ImportUrl: undefined;
  ScanRecipe: undefined;
  Processing: { url: string } | { imageBase64: string; mimeType: string };
  ReviewImport: { draft: import('../types').Recipe };
  EditRecipe: { id: string };
  Grocery: undefined;
  MealPlan: undefined;
  Profile: undefined;
  Receipts: undefined;
  ScanReceipt: undefined;
  ReviewReceipt: { draft: import('../types').Receipt };
};

export type MainTab = 'recipes' | 'mealplan' | 'grocery' | 'profile';
