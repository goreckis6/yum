import * as Notifications from 'expo-notifications';
import { MealPlan, MealReminderOverride, MealSlot } from '../types';
import { fromISO } from '../utils/dates';

// Show meal reminders (with sound) even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Default clock time each slot is "due". The reminder fires `lead` minutes before.
const SLOT_TIME: Record<MealSlot, { h: number; m: number }> = {
  Breakfast: { h: 8, m: 0 },
  SecondBreakfast: { h: 10, m: 30 },
  Lunch: { h: 13, m: 0 },
  Dinner: { h: 18, m: 0 },
  Snack: { h: 16, m: 0 },
  Supper: { h: 20, m: 0 },
};

const KIND = 'meal-reminder';
const MAX_SCHEDULED = 60; // stay under the iOS 64 pending-notification limit

const pad2 = (n: number) => String(n).padStart(2, '0');

// A slot's built-in default time as "HH:MM" — exposed for UI that lets the
// user see/override it per meal.
export function defaultSlotTime(slot: MealSlot): string {
  const t = SLOT_TIME[slot];
  return `${pad2(t.h)}:${pad2(t.m)}`;
}

// Parses a "HH:MM" 24h string; returns null if it isn't a valid time.
export function parseTimeStr(v: string): { h: number; m: number } | null {
  const m = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Remove only OUR previously-scheduled meal reminders (leave anything else).
export async function cancelMealReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    all
      .filter((n) => (n.content.data as { kind?: string } | undefined)?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Remove ALREADY-DELIVERED meal reminders sitting in Notification Center (only
// ours). Used when the app language changes, so the stack doesn't keep showing
// old-language reminders next to newly-scheduled ones.
export async function dismissDeliveredMealReminders(): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    presented
      .filter((n) => (n.request.content.data as { kind?: string } | undefined)?.kind === KIND)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}

// Clear and re-create one-time reminders for each FUTURE planned meal, firing
// `leadMinutes` before the slot's default time. `content` returns the localized
// title/body (with the meal's name) or null to skip.
export async function scheduleMealReminders(
  plan: MealPlan,
  leadMinutes: number,
  overrides: Record<string, MealReminderOverride>,
  content: (date: string, slot: MealSlot) => { title: string; body: string } | null,
): Promise<void> {
  await cancelMealReminders();

  const now = Date.now();
  const jobs: { when: Date; title: string; body: string }[] = [];

  for (const date of Object.keys(plan)) {
    const slots = plan[date];
    if (!slots) continue;
    for (const slot of Object.keys(slots) as MealSlot[]) {
      if (!slots[slot]) continue;

      const override = overrides[`${date}|${slot}`];
      if (override?.enabled === false) continue; // muted for this specific meal

      const t = (override?.time && parseTimeStr(override.time)) || SLOT_TIME[slot];
      const when = fromISO(date);
      when.setHours(t.h, t.m, 0, 0);
      when.setMinutes(when.getMinutes() - leadMinutes);
      if (when.getTime() <= now) continue; // skip past meals

      const body = content(date, slot);
      if (!body) continue;
      jobs.push({ when, title: body.title, body: body.body });
    }
  }

  // Soonest first, capped so we never blow past the OS pending limit.
  jobs.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const job of jobs.slice(0, MAX_SCHEDULED)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: job.title,
        body: job.body,
        // Custom gentle chime bundled via the expo-notifications plugin
        // (app.json). Falls back to the default sound if unavailable.
        sound: 'meal-chime.wav',
        data: { kind: KIND },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: job.when },
    });
  }
}
