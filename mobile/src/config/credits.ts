// Freemium import credits. A new account gets FREE_IMPORT_CREDITS free recipe
// extractions (from a link or a photo). A credit is spent only on a SUCCESSFUL
// extraction — a "no recipe found" fallback never costs a credit.
export const FREE_IMPORT_CREDITS = 10;

// Premium subscribers import without any limit; free accounts get
// FREE_IMPORT_CREDITS. (In dev there's no RevenueCat key, so everyone is a free
// account and the counter is fully visible/testable.)
export const PREMIUM_UNLIMITED = true;
