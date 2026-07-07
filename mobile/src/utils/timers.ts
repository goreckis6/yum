// Detect cook timers inside a recipe step ("bake for 25 minutes", "piecz 25 min",
// "simmer 1 hour", "odstaw na 1,5 godziny"). Returns every duration found, in the
// order it appears, so the Cooking Mode can offer a one-tap countdown per step.

export interface StepTimer {
  seconds: number;
  label: string; // human label, e.g. "25 min", "1 h 30 min"
}

// Unit → seconds. Covers EN + PL word stems (Polish declines heavily, so we
// match on stems: "minut", "godzin", "sekund").
const HOUR = /^(h|hr|hrs|hour|hours|godz|godzin|godzina|godziny|godzinę|godzine)$/i;
const MIN = /^(m|min|mins|minute|minutes|minut|minuta|minuty|minutę|minute)$/i;
const SEC = /^(s|sec|secs|second|seconds|sekund|sekunda|sekundy|sekundę|sekunde)$/i;

// One number token — accepts "25", "1.5", "1,5", "1 1/2", "1/2".
function parseNum(raw: string): number {
  const s = raw.trim().replace(',', '.');
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/); // mixed "1 1/2"
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/); // fraction "1/2"
  if (m) return Number(m[1]) / Number(m[2]);
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

const NUM = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+[.,]?\d*`;
// number (optionally a range "20-25") followed by a unit word.
const TIMER_RE = new RegExp(
  String.raw`(${NUM})(?:\s*[-–—to]+\s*(${NUM}))?\s*([a-ząćęłńóśźż]+)`,
  'gi',
);

function unitToSeconds(value: number, unit: string): number | null {
  if (HOUR.test(unit)) return Math.round(value * 3600);
  if (MIN.test(unit)) return Math.round(value * 60);
  if (SEC.test(unit)) return Math.round(value);
  return null;
}

export function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s > 0 ? `${m} min ${s}s` : `${m} min`;
  return `${s}s`;
}

// Live mm:ss (or h:mm:ss) readout for a running countdown.
export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function extractTimers(step: string): StepTimer[] {
  if (!step) return [];
  const out: StepTimer[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  TIMER_RE.lastIndex = 0;
  while ((m = TIMER_RE.exec(step)) !== null) {
    const unit = m[3];
    // On a range ("20-25 min") use the upper bound so nothing under-cooks.
    const value = m[2] ? Math.max(parseNum(m[1]), parseNum(m[2])) : parseNum(m[1]);
    if (value <= 0) continue;
    const seconds = unitToSeconds(value, unit);
    if (seconds === null || seconds < 5 || seconds > 24 * 3600) continue;
    if (seen.has(seconds)) continue;
    seen.add(seconds);
    out.push({ seconds, label: formatTimer(seconds) });
  }
  return out;
}
