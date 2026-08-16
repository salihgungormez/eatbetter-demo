import { Meal, MealItem } from '@/types/meal';
import { normalizeIngredientName } from '@/services/correction-memory';

export type PersonalFoodPattern = {
  canonicalName: string;
  displayName: string;
  mealType: Meal['mealType'];
  mealCount: number;
  occurrenceCount: number;
  frequency: number;
  typicalAmount?: number;
  unit?: MealItem['unit'];
};

const dayMs = 86400000;

// Does not infer a personal habit before enough repetitions are available.
export function derivePersonalFoodPatterns(
  meals: Meal[],
  now = new Date(),
  days = 30,
): PersonalFoodPattern[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const recent = meals.filter((meal) => {
    const created = new Date(meal.createdAt);
    const createdDay = new Date(
      created.getFullYear(),
      created.getMonth(),
      created.getDate(),
    ).getTime();
    const age = Math.round((today - createdDay) / dayMs);
    return age >= 0 && age < days;
  });
  const mealsByType = new Map<Meal['mealType'], Meal[]>();
  recent.forEach((meal) =>
    mealsByType.set(meal.mealType, [...(mealsByType.get(meal.mealType) ?? []), meal]),
  );
  const patterns: PersonalFoodPattern[] = [];
  mealsByType.forEach((typeMeals, mealType) => {
    const totals = new Map<
      string,
      { displayName: string; count: number; amounts: number[]; unit?: MealItem['unit'] }
    >();
    typeMeals.forEach((meal) => {
      const seenInMeal = new Set<string>();
      meal.items.forEach((item) => {
        const canonicalName = normalizeIngredientName(item.name);
        if (!canonicalName || seenInMeal.has(canonicalName)) return;
        seenInMeal.add(canonicalName);
        const current = totals.get(canonicalName) ?? {
          displayName: item.name,
          count: 0,
          amounts: [],
          unit: item.unit,
        };
        current.count += 1;
        if (current.unit === item.unit && Number.isFinite(item.amount))
          current.amounts.push(item.amount);
        totals.set(canonicalName, current);
      });
    });
    totals.forEach((value, canonicalName) => {
      const frequency = value.count / typeMeals.length;
      if (typeMeals.length < 3 || value.count < 3 || frequency < 0.6) return;
      patterns.push({
        canonicalName,
        displayName: value.displayName,
        mealType,
        mealCount: typeMeals.length,
        occurrenceCount: value.count,
        frequency: Number(frequency.toFixed(2)),
        typicalAmount: value.amounts.length
          ? Math.round(
              value.amounts.reduce((sum, amount) => sum + amount, 0) / value.amounts.length,
            )
          : undefined,
        unit: value.amounts.length ? value.unit : undefined,
      });
    });
  });
  return patterns
    .sort((a, b) => b.frequency - a.frequency || b.occurrenceCount - a.occurrenceCount)
    .slice(0, 12);
}
// Extracts recurring personal food and portion patterns from meal history.
