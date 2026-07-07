import * as Notifications from 'expo-notifications';
import { DayKey, MealPlan, MealSlot } from '../types';

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

// expo-notifications weekday is 1=Sunday … 7=Saturday.
const DAY_WEEKDAY: Record<DayKey, number> = {
  Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
};

const KIND = 'meal-reminder';

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

// Clear and re-create weekly reminders for every planned meal. `content` returns
// the localized title/body (with the meal's name) or null to skip a slot.
export async function scheduleMealReminders(
  plan: MealPlan,
  leadMinutes: number,
  content: (day: DayKey, slot: MealSlot) => { title: string; body: string } | null,
): Promise<void> {
  await cancelMealReminders();

  for (const day of Object.keys(plan) as DayKey[]) {
    const slots = plan[day];
    if (!slots) continue;
    for (const slot of Object.keys(slots) as MealSlot[]) {
      if (!slots[slot]) continue;
      const body = content(day, slot);
      if (!body) continue;

      const t = SLOT_TIME[slot];
      let total = t.h * 60 + t.m - leadMinutes;
      if (total < 0) total += 24 * 60; // wrap before midnight
      const hour = Math.floor(total / 60);
      const minute = total % 60;

      await Notifications.scheduleNotificationAsync({
        content: { title: body.title, body: body.body, sound: true, data: { kind: KIND } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: DAY_WEEKDAY[day],
          hour,
          minute,
        },
      });
    }
  }
}
