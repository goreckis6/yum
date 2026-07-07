// Compact "time ago" strings for cooking history, localized EN + PL with
// correct Polish plural forms.

type Lang = 'en' | 'pl';

// Polish picks one of three forms depending on the number.
function plForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export function timeAgo(ts: number, lang: Lang): string {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const day = 86400_000;
  const days = Math.floor(diff / day);

  if (lang === 'pl') {
    if (days === 0) return 'dziś';
    if (days === 1) return 'wczoraj';
    if (days < 7) return `${days} dni temu`;
    if (days < 30) {
      const w = Math.round(days / 7);
      return `${w} ${plForm(w, 'tydzień', 'tygodnie', 'tygodni')} temu`;
    }
    if (days < 365) {
      const m = Math.round(days / 30);
      return `${m} ${plForm(m, 'miesiąc', 'miesiące', 'miesięcy')} temu`;
    }
    const y = Math.round(days / 365);
    return `${y} ${plForm(y, 'rok', 'lata', 'lat')} temu`;
  }

  // English
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m} ${m === 1 ? 'month' : 'months'} ago`;
  }
  const y = Math.round(days / 365);
  return `${y} ${y === 1 ? 'year' : 'years'} ago`;
}
