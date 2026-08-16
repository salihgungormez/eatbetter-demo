export type NutritionValues = { calories: number; protein: number; carbs: number; fat: number };
export type NormalizedBoundingBox = { x: number; y: number; width: number; height: number };
export type NormalizedPoint = { x: number; y: number };
export type FoodCandidate = { id: string; canonicalName: string; displayName: string; confidence: number; estimatedGrams: number; nutritionPer100g: NutritionValues };
export type FoodRegion = { id: string; boundingBox: NormalizedBoundingBox; anchor: NormalizedPoint; status: 'recognized' | 'ambiguous' | 'unknown'; selectedCandidateId?: string; candidates: FoodCandidate[]; memoryRecommendation?: { candidateId: string; boost: number } };
export type HiddenIngredientSuggestion = { id: string; canonicalName: string; displayName: string; estimatedGrams: number; nutritionPer100g: NutritionValues; confidence: number; reason: string };
export type UncertaintyOption = { id: string; label: string; candidateId?: string; grams?: number };
export type UncertaintyQuestion = { id: string; regionId?: string; kind: 'ingredient' | 'portion' | 'hidden'; prompt: string; reason: string; options: UncertaintyOption[] };

export type MealItem = {
  id: string; name: string; amount: number; unit: 'g' | 'ml' | 'piece'; calories: number; protein: number; carbs: number; fat: number; confidence: number; correctedByUser: boolean;
  regions?: Array<{ x: number; y: number; width: number; height: number }>;
  anchor?: { x: number; y: number };
};
export type MealSuggestion = Omit<MealItem, 'id' | 'correctedByUser'>;
export type Meal = { id: string; name: string; imageUri?: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; items: MealItem[]; foodRegions?: FoodRegion[]; initialFoodRegions?: FoodRegion[]; plateRegion?: NormalizedBoundingBox; hiddenIngredientSuggestions?: HiddenIngredientSuggestion[]; uncertaintyQuestions?: UncertaintyQuestion[]; coverageComplete?: boolean; coverageNotes?: string[]; initialItems?: MealItem[]; suggestions?: MealSuggestion[]; correctionCount?: number; createdAt: string };
export type DraftMeal = Omit<Meal, 'id' | 'createdAt'>;
// Domain models for meals, visible food regions, candidate predictions, and nutrition values.
