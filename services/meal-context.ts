import { Meal } from '@/types/meal';
import { PersonalFoodPattern, derivePersonalFoodPatterns } from '@/services/personal-profile';

export type MealType = Meal['mealType'];
export type MealHistoryEntry = {
  date: string;
  mealType: MealType;
  createdAt: string;
  name: string;
  items: string[];
};
export type MealContext = {
  mealType: MealType;
  isFirstMeal: boolean;
  reason: string;
  todayMeals: Array<{ mealType: MealType; createdAt: string; name: string }>;
  recentMeals: MealHistoryEntry[];
  personalPatterns: PersonalFoodPattern[];
};

const windows: Array<{ mealType: MealType; start: number; end: number }> = [
  { mealType: 'breakfast', start: 5, end: 11 },
  { mealType: 'lunch', start: 11, end: 16 },
  { mealType: 'dinner', start: 16, end: 23 },
];

export function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function getTodayMeals(meals: Meal[], now = new Date()): Meal[] {
  const today = dateKey(now);
  return meals.filter((meal) => dateKey(new Date(meal.createdAt)) === today);
}
export function getRecentMeals(meals: Meal[], now = new Date(), days = 14): MealHistoryEntry[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return meals
    .filter((meal) => {
      const created = new Date(meal.createdAt);
      const createdDay = new Date(
        created.getFullYear(),
        created.getMonth(),
        created.getDate(),
      ).getTime();
      const age = Math.round((today - createdDay) / 86400000);
      return age >= 0 && age < days;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((meal) => ({
      date: dateKey(new Date(meal.createdAt)),
      mealType: meal.mealType,
      createdAt: meal.createdAt,
      name: meal.name,
      items: meal.items.slice(0, 8).map((item) => `${item.name} ${item.amount}${item.unit}`),
    }));
}

// Uses time as a weak meal suggestion together with history, never as a definitive label.
export function inferMealContext(now = new Date(), meals: Meal[] = []): MealContext {
  const hour = now.getHours() + now.getMinutes() / 60;
  const todayMeals = getTodayMeals(meals, now);
  const recentMeals = getRecentMeals(meals, now);
  const personalPatterns = derivePersonalFoodPatterns(meals, now);
  const window = windows.find((item) => hour >= item.start && hour < item.end);
  const mealType = window?.mealType ?? 'snack';
  const label =
    mealType === 'breakfast'
      ? 'kahvaltı'
      : mealType === 'lunch'
        ? 'öğle yemeği'
        : mealType === 'dinner'
          ? 'akşam yemeği'
          : 'ara öğün';
  const reason = window
    ? `${window.start}:00–${window.end}:00 aralığı ${label} için uygun.`
    : 'Saat aralığı ara öğüne yakın.';
  const isFirstMeal = todayMeals.length === 0;
  const logged = todayMeals.filter((meal) => meal.mealType === mealType).length;
  const contextualReason = isFirstMeal
    ? `${reason} Bugün henüz öğün kaydı yok; geç uyanılmış olabilir. Bu, günün ilk öğünü veya brunch olabilir.`
    : logged
      ? `${reason} Bugün bu türden ${logged} öğün daha kaydedildi; tekrar kontrol et.`
      : reason;
  return {
    mealType,
    isFirstMeal,
    reason: contextualReason,
    todayMeals: todayMeals.map((meal) => ({
      mealType: meal.mealType,
      createdAt: meal.createdAt,
      name: meal.name,
    })),
    recentMeals,
    personalPatterns,
  };
}

// Passes user context to the AI and states that visual evidence always takes priority.
export function mealContextPrompt(context?: MealContext): string {
  if (!context) return '';
  const logged = context.todayMeals.length
    ? context.todayMeals.map((meal) => `${meal.mealType}: ${meal.name}`).join(', ')
    : 'bugün henüz kayıt yok';
  const patterns = context.personalPatterns.length
    ? context.personalPatterns
        .map(
          (pattern) =>
            `${pattern.mealType}: ${pattern.displayName} ${Math.round(pattern.frequency * 100)}% (${pattern.occurrenceCount}/${pattern.mealCount}${pattern.typicalAmount ? `, yaklaşık ${pattern.typicalAmount}${pattern.unit ?? 'g'}` : ''})`,
        )
        .join(' | ')
    : 'henüz yeterli tekrar eden örüntü yok';
  return `Meal context is a weak prior only. Suggested meal type: ${context.mealType}. Is this the first meal today? ${context.isFirstMeal ? 'YES — the user may have woken up late, so this can be a first meal or brunch even if the clock suggests lunch or dinner.' : 'NO'}. Reason: ${context.reason}. Meals already logged today: ${logged}. Locally derived personal patterns (calculated on-device from recent meals; minimum 3 meals and 60% recurrence): ${patterns}. Use personal patterns only as a conservative prior for plausible naming or portions; never invent, remove, or reclassify visible food because of history. Current visual evidence always wins.`;
}
// Builds a weak meal context for the AI from the time, today's records, and recent meal history.
