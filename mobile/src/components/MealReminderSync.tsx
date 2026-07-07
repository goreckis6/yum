import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import {
  cancelMealReminders,
  ensureNotificationPermission,
  scheduleMealReminders,
} from '../lib/notifications';

// Keeps the OS-scheduled meal reminders in sync with the meal plan + settings.
// Renders nothing; lives inside AppProvider so it can read the plan and i18n.
export function MealReminderSync() {
  const { ready, mealPlan, mealReminders, getRecipe } = useApp();
  const { t } = useI18n();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      if (!mealReminders.enabled) {
        await cancelMealReminders();
        return;
      }
      const ok = await ensureNotificationPermission();
      if (!ok || cancelled) return;

      await scheduleMealReminders(mealPlan, mealReminders.lead, (date, slot) => {
        const entry = mealPlan[date]?.[slot];
        if (!entry) return null;
        const name = entry.type === 'recipe' ? getRecipe(entry.recipeId)?.title : entry.name;
        if (!name) return null;
        return {
          title: t('reminder.title', { slot: t(`slot.${slot}` as TKey) }),
          body: t('reminder.body', { name }),
        };
      });
    };

    // Debounce so rapid plan edits reschedule once.
    const id = setTimeout(run, 800);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [ready, mealReminders.enabled, mealReminders.lead, mealPlan, getRecipe, t]);

  return null;
}
