import { DraftMeal, FoodRegion } from '@/types/meal';
import { regionsToMealItems } from '@/utils/food-regions';

export async function analyzeMeal(imageUri?: string, description?: string): Promise<DraftMeal> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  const whiteRegion: FoodRegion = {
    id: 'region-white-food',
    boundingBox: { x: 0.2, y: 0.34, width: 0.32, height: 0.2 },
    anchor: { x: 0.36, y: 0.44 },
    status: 'ambiguous',
    candidates: [
      {
        id: 'candidate-yogurt',
        canonicalName: 'yogurt',
        displayName: 'Yoğurt',
        confidence: 0.52,
        estimatedGrams: 100,
        nutritionPer100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
      },
      {
        id: 'candidate-curd-cheese',
        canonicalName: 'curd-cheese',
        displayName: 'Lor peyniri',
        confidence: 0.41,
        estimatedGrams: 100,
        nutritionPer100g: { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
      },
    ],
  };
  const regions: FoodRegion[] = [
    whiteRegion,
    {
      id: 'region-visible-food',
      boundingBox: { x: 0.58, y: 0.2, width: 0.26, height: 0.24 },
      anchor: { x: 0.71, y: 0.32 },
      status: 'recognized',
      selectedCandidateId: 'candidate-bread',
      candidates: [
        {
          id: 'candidate-bread',
          canonicalName: 'bread',
          displayName: 'Ekmek',
          confidence: 0.9,
          estimatedGrams: 80,
          nutritionPer100g: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
        },
      ],
    },
  ];
  const items = regionsToMealItems(regions);
  return {
    name: description?.trim() ? 'Fotoğraftaki öğün' : 'Görsel öğün',
    imageUri,
    mealType: 'lunch',
    plateRegion: { x: 0.05, y: 0.08, width: 0.9, height: 0.82 },
    foodRegions: regions,
    initialFoodRegions: regions.map((region) => ({
      ...region,
      candidates: region.candidates.map((candidate) => ({
        ...candidate,
        nutritionPer100g: { ...candidate.nutritionPer100g },
      })),
    })),
    hiddenIngredientSuggestions: [],
    uncertaintyQuestions: [
      {
        id: 'question-white-food',
        regionId: 'region-white-food',
        kind: 'ingredient',
        prompt: 'Bu beyaz ürün nedir?',
        reason:
          'Yoğurt ve lor peyniri görsel olarak benzer; seçim toplam proteini ve kaloriyi etkiliyor.',
        options: [
          { id: 'option-yogurt', label: 'Yoğurt · %52', candidateId: 'candidate-yogurt' },
          {
            id: 'option-curd-cheese',
            label: 'Lor peyniri · %41',
            candidateId: 'candidate-curd-cheese',
          },
          { id: 'option-other', label: 'Başka ürün seç' },
        ],
      },
    ],
    coverageComplete: true,
    coverageNotes: [],
    items,
    initialItems: items.map((item) => ({ ...item })),
    suggestions: [],
  };
}
// Controlled mock analysis result used to keep the demo flow working without an API key.
