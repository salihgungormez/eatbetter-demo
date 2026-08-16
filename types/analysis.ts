import { z } from 'zod';

const VisualRegionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0).max(1), height: z.number().min(0).max(1) });

const ChangeSchema = z.object({ ingredientCanonicalName: z.string(), grams: z.number().optional(), add: z.boolean().optional(), remove: z.boolean().optional() });
export const FinalMealAnalysisSchema = z.object({
  ingredients: z.array(z.object({ id: z.string(), canonicalName: z.string(), displayName: z.string(), estimatedGrams: z.number(), gramRange: z.object({ min: z.number(), max: z.number() }), calories: z.number(), protein: z.number(), carbohydrates: z.number(), fat: z.number(), confidence: z.number().min(0).max(1), editable: z.literal(true), regions: z.array(VisualRegionSchema).optional(), anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional() })),
  possibleMissingIngredients: z.array(z.object({ canonicalName: z.string(), displayName: z.string(), estimatedGrams: z.number(), estimatedCalories: z.number(), confidence: z.number().min(0).max(1), reason: z.string() })),
  uncertaintyFactors: z.array(z.object({ id: z.string(), label: z.string(), reason: z.string(), minimumCalorieImpact: z.number(), maximumCalorieImpact: z.number(), confidence: z.number().min(0).max(1) })),
  clarificationQuestions: z.array(z.object({ id: z.string(), question: z.string(), reason: z.string(), expectedCalorieImpact: z.number(), options: z.array(z.object({ id: z.string(), label: z.string(), changes: z.array(ChangeSchema) })) })).max(2),
  totals: z.object({ estimatedCalories: z.number(), minimumCalories: z.number(), maximumCalories: z.number(), protein: z.number(), carbohydrates: z.number(), fat: z.number() }),
});
export type FinalMealAnalysis = z.infer<typeof FinalMealAnalysisSchema>;
// Contains the core response types used throughout the analysis pipeline.
