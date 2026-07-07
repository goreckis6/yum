import { DayKey } from '../types';

// The meal plan is keyed by a LOCAL calendar date, "YYYY-MM-DD".
export type ISODate = string;

// getDay(): 0=Sun … 6=Sat
const WEEKDAY: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function isISODate(v: unknown): v is ISODate {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function addDaysISO(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function weekdayKey(iso: ISODate): DayKey {
  return WEEKDAY[fromISO(iso).getDay()];
}

export function dayOfMonth(iso: ISODate): number {
  return fromISO(iso).getDate();
}

export function isTodayISO(iso: ISODate): boolean {
  return iso === todayISO();
}

// A contiguous list of ISO dates from center-back … center+fwd.
export function windowISO(centerISO: ISODate, back: number, fwd: number): ISODate[] {
  const out: ISODate[] = [];
  for (let i = -back; i <= fwd; i++) out.push(addDaysISO(centerISO, i));
  return out;
}

// Every date from start…end inclusive (ISO strings compare chronologically).
// `maxDays` caps runaway ranges (e.g. a date picked years out).
export function rangeISO(startISO: ISODate, endISO: ISODate, maxDays = 800): ISODate[] {
  const [a, b] = startISO <= endISO ? [startISO, endISO] : [endISO, startISO];
  const out: ISODate[] = [];
  let d = a;
  while (d <= b && out.length < maxDays) {
    out.push(d);
    d = addDaysISO(d, 1);
  }
  return out;
}

// Month grid (Mon-first) for a calendar: leading blanks then each day's ISO.
export function monthGrid(year: number, month0: number): (ISODate | null)[] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  // JS weekday 0=Sun; shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const cells: (ISODate | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month0, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

export function monthLabel(year: number, month0: number, lang: string): string {
  const name = (lang === 'pl' ? MONTHS_PL : MONTHS_EN)[month0];
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return `${cap} ${year}`;
}
