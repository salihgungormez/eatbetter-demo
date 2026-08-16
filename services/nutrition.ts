import { FoodRegion, NutritionValues } from '@/types/meal';

/**
 * Small, controlled MVP dataset. The model may identify a food, but the app
 * owns the final arithmetic and uses these values whenever the name is known.
 */
const DATASET: Record<string, NutritionValues> = {
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  pilav: { calories: 160, protein: 3, carbs: 30, fat: 3 },
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  tavuk: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  broccoli: { calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  potato: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  potatoes: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  patates: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  yogurt: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  'curd cheese': { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  'lor cheese': { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  'lor peyniri': { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  ekmek: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  egg: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  yumurta: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  tomato: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  domates: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  cucumber: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  salatalik: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
};

export function normalizeFoodName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .trim();
}

export function lookupNutrition(canonicalName: string): NutritionValues | undefined {
  const normalized = normalizeFoodName(canonicalName);
  const key = Object.keys(DATASET).find((item) => normalizeFoodName(item) === normalized);
  return key ? DATASET[key] : undefined;
}

// Replaces model nutrition estimates with values from the controlled dataset when the food is known.
export function applyControlledNutrition(regions: FoodRegion[]): FoodRegion[] {
  return regions.map((region) => ({
    ...region,
    candidates: region.candidates.map((candidate) => ({
      ...candidate,
      nutritionPer100g: lookupNutrition(candidate.canonicalName) ?? candidate.nutritionPer100g,
    })),
  }));
}

// Calculates deterministic totals from grams; unselected candidates never contribute.
export function calculateNutrition(regions: FoodRegion[]): NutritionValues {
  return regions.reduce(
    (total, region) => {
      const selected = region.selectedCandidateId
        ? region.candidates.find((candidate) => candidate.id === region.selectedCandidateId)
        : undefined;
      if (!selected) return total;
      const ratio = Math.max(0, selected.estimatedGrams) / 100;
      return {
        calories: total.calories + Math.round(selected.nutritionPer100g.calories * ratio),
        protein: total.protein + selected.nutritionPer100g.protein * ratio,
        carbs: total.carbs + selected.nutritionPer100g.carbs * ratio,
        fat: total.fat + selected.nutritionPer100g.fat * ratio,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
// Deterministic nutrition calculation using the controlled dataset and selected region candidates.
