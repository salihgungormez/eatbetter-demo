import { z } from 'zod';

export const NormalizedBoundingBoxSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export const NormalizedPointSchema = z.object({ x: z.number(), y: z.number() });
const NutritionValuesSchema = z.object({ calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() });
export const FoodCandidateSchema = z.object({ id: z.string(), canonicalName: z.string(), displayName: z.string(), confidence: z.number(), estimatedGrams: z.number(), nutritionPer100g: NutritionValuesSchema });
export const FoodRegionSchema = z.object({ id: z.string(), boundingBox: NormalizedBoundingBoxSchema, anchor: NormalizedPointSchema, status: z.enum(['recognized', 'ambiguous', 'unknown']), selectedCandidateId: z.string().optional(), candidates: z.array(FoodCandidateSchema) });
export const HiddenIngredientSuggestionSchema = z.object({ id: z.string(), canonicalName: z.string(), displayName: z.string(), estimatedGrams: z.number(), nutritionPer100g: NutritionValuesSchema, confidence: z.number(), reason: z.string() });
const UncertaintyOptionSchema = z.object({ id: z.string(), label: z.string(), candidateId: z.string().optional(), grams: z.number().optional() });
export const UncertaintyQuestionSchema = z.object({ id: z.string(), regionId: z.string().optional(), kind: z.enum(['ingredient', 'portion', 'hidden']), prompt: z.string(), reason: z.string(), options: z.array(UncertaintyOptionSchema).min(2).max(5) });
export const VisualMealAnalysisSchema = z.object({ name: z.string(), mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), plateRegion: NormalizedBoundingBoxSchema, foodRegions: z.array(FoodRegionSchema), hiddenIngredientSuggestions: z.array(HiddenIngredientSuggestionSchema), uncertaintyQuestions: z.array(UncertaintyQuestionSchema).optional() });
export type VisualMealAnalysis = z.infer<typeof VisualMealAnalysisSchema>;
export const CoverageVerificationSchema = z.object({ complete: z.boolean(), missingRegions: z.array(FoodRegionSchema), duplicateRegionIds: z.array(z.string()), inconsistentReferences: z.array(z.string()), notes: z.array(z.string()) });
export type CoverageVerification = z.infer<typeof CoverageVerificationSchema>;
// Zod schemas and coverage models for safely validating Gemini responses.
