export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Home: undefined;
  RecipeDetail: { id: string };
  CookingMode: { id: string };
  // `reason` drives the paywall headline: hitting the free-import wall reads
  // very differently from tapping the credits pill to explore Premium.
  Paywall: { reason?: 'out_of_credits' | 'upsell' } | undefined;
  ImportUrl: undefined;
  ScanRecipe: undefined;
  Processing: { url: string } | { imageBase64: string; mimeType: string };
  ReviewImport: { draft: import('../types').Recipe; manual?: boolean };
  EditRecipe: { id: string };
  Grocery: undefined;
  MealPlan: undefined;
  Profile: undefined;
  Receipts: undefined;
  ReceiptDetail: { id: string };
  ScanReceipt: undefined;
  ScanBarcode: undefined;
  Pantry: undefined;
  ReviewReceipt: { draft: import('../types').Receipt; imageBase64?: string; mimeType?: string };
};

export type MainTab = 'recipes' | 'mealplan' | 'grocery' | 'profile';
