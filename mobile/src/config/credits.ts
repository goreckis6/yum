// Freemium import credits. A new account gets FREE_IMPORT_CREDITS free recipe
// extractions (from a link or a photo). A credit is spent only on a SUCCESSFUL
// extraction — a "no recipe found" fallback never costs a credit.
export const FREE_IMPORT_CREDITS = 10;

// At or below this many remaining imports we warn the user (toast after an
// import + a red tint on the credits pill) so running out isn't a surprise.
export const LOW_CREDITS_WARNING = 3;

// Premium subscribers import without any limit; free accounts get
// FREE_IMPORT_CREDITS. (In dev there's no RevenueCat key, so everyone is a free
// account and the counter is fully visible/testable.)
export const PREMIUM_UNLIMITED = true;
