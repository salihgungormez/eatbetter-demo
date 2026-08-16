import { FoodCandidate, FoodRegion, MealItem, NutritionValues } from '@/types/meal';
import { localizeFoodName } from '@/utils/localization';

export function isRegionInsidePlate(region: FoodRegion, plate: { x: number; y: number; width: number; height: number }): boolean {
  const centerX = region.boundingBox.x + region.boundingBox.width / 2;
  const centerY = region.boundingBox.y + region.boundingBox.height / 2;
  return centerX >= plate.x && centerX <= plate.x + plate.width && centerY >= plate.y && centerY <= plate.y + plate.height;
}

// Returns only the selected candidate from the alternatives.
export function selectedCandidate(region: FoodRegion): FoodCandidate | undefined {
  return region.selectedCandidateId ? region.candidates.find((candidate) => candidate.id === region.selectedCandidateId) : undefined;
}

export function candidateNutrition(candidate: FoodCandidate): NutritionValues {
  const ratio = Math.max(0, candidate.estimatedGrams) / 100;
  return { calories: Math.round(candidate.nutritionPer100g.calories * ratio), protein: Number((candidate.nutritionPer100g.protein * ratio).toFixed(1)), carbs: Number((candidate.nutritionPer100g.carbs * ratio).toFixed(1)), fat: Number((candidate.nutritionPer100g.fat * ratio).toFixed(1)) };
}

// Sums nutrition only for the selected candidate within each region.
export function regionTotals(regions: FoodRegion[]): NutritionValues {
  return regions.reduce((total, region) => {
    const candidate = selectedCandidate(region);
    if (!candidate) return total;
    const nutrition = candidateNutrition(candidate);
    return { calories: total.calories + nutrition.calories, protein: total.protein + nutrition.protein, carbs: total.carbs + nutrition.carbs, fat: total.fat + nutrition.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// Builds the editable list below the image from the same FoodRegion state.
export function regionsToMealItems(regions: FoodRegion[]): MealItem[] {
  return regions.flatMap((region) => {
    const candidate = selectedCandidate(region) ?? region.candidates[0];
    if (!candidate) return [];
    const nutrition = region.selectedCandidateId ? candidateNutrition(candidate) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return [{ id: region.id, name: localizeFoodName(candidate.displayName), amount: candidate.estimatedGrams, unit: 'g' as const, ...nutrition, confidence: candidate.confidence, correctedByUser: Boolean(region.selectedCandidateId), regions: [region.boundingBox], anchor: region.anchor }];
  });
}

// Applies a candidate change to the same region without creating a new ingredient.
export function selectCandidate(region: FoodRegion, candidateId: string): FoodRegion {
  if (!region.candidates.some((candidate) => candidate.id === candidateId)) return region;
  return { ...region, selectedCandidateId: candidateId, status: 'recognized' };
}

// Completes the user's assignment on the same region when an unknown region is identified.
export function assignUnknownRegion(region: FoodRegion, candidate: FoodCandidate): FoodRegion {
  return { ...region, status: 'recognized', selectedCandidateId: candidate.id, candidates: [...region.candidates, candidate] };
}
// Rules for converting FoodRegion state into selected candidates, meal items, and nutrition totals.
