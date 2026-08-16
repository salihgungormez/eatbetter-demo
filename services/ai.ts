import { Alert } from 'react-native';
import { analyzeMeal as analyzeMockMeal } from './mock-ai';
import {
  DraftMeal,
  FoodCandidate,
  FoodRegion,
  HiddenIngredientSuggestion,
  NutritionValues,
  UncertaintyQuestion,
} from '@/types/meal';
import { isRegionInsidePlate, regionsToMealItems } from '@/utils/food-regions';
import {
  CoverageVerification,
  CoverageVerificationSchema,
  VisualMealAnalysis,
  VisualMealAnalysisSchema,
} from '@/types/visual-meal-analysis';
import { coverageNeedsRetry, duplicateRegionIds, mergeMissingRegions } from '@/utils/coverage';
import { MealContext, mealContextPrompt } from '@/services/meal-context';
import { applyControlledNutrition } from '@/services/nutrition';
import { localizeFoodName, localizeMealName } from '@/utils/localization';

const MODEL = 'gemini-3.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const number = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const nutrition = (value: Record<string, unknown> | undefined): NutritionValues => ({
  calories: Math.max(0, number(value?.calories)),
  protein: Math.max(0, number(value?.protein)),
  carbs: Math.max(0, number(value?.carbs ?? value?.carbohydrates)),
  fat: Math.max(0, number(value?.fat)),
});
const point = (value: Record<string, unknown> | undefined) => ({
  x: Math.min(1, Math.max(0, number(value?.x))),
  y: Math.min(1, Math.max(0, number(value?.y))),
});
const box = (value: Record<string, unknown> | undefined) => ({
  x: Math.min(1, Math.max(0, number(value?.x))),
  y: Math.min(1, Math.max(0, number(value?.y))),
  width: Math.min(1, Math.max(0, number(value?.width))),
  height: Math.min(1, Math.max(0, number(value?.height))),
});
const candidateSchema = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    canonicalName: { type: 'STRING' },
    displayName: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    estimatedGrams: { type: 'NUMBER' },
    nutritionPer100g: {
      type: 'OBJECT',
      properties: {
        calories: { type: 'NUMBER' },
        protein: { type: 'NUMBER' },
        carbs: { type: 'NUMBER' },
        fat: { type: 'NUMBER' },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
    },
  },
  required: [
    'id',
    'canonicalName',
    'displayName',
    'confidence',
    'estimatedGrams',
    'nutritionPer100g',
  ],
};
const regionSchema = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    boundingBox: {
      type: 'OBJECT',
      properties: {
        x: { type: 'NUMBER' },
        y: { type: 'NUMBER' },
        width: { type: 'NUMBER' },
        height: { type: 'NUMBER' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
    anchor: {
      type: 'OBJECT',
      properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } },
      required: ['x', 'y'],
    },
    status: { type: 'STRING', enum: ['recognized', 'ambiguous', 'unknown'] },
    candidates: { type: 'ARRAY', items: candidateSchema },
  },
  required: ['id', 'boundingBox', 'anchor', 'status', 'candidates'],
};
const inventorySchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    mealType: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    plateRegion: {
      type: 'OBJECT',
      properties: {
        x: { type: 'NUMBER' },
        y: { type: 'NUMBER' },
        width: { type: 'NUMBER' },
        height: { type: 'NUMBER' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
    foodRegions: { type: 'ARRAY', items: regionSchema },
    hiddenIngredientSuggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          canonicalName: { type: 'STRING' },
          displayName: { type: 'STRING' },
          estimatedGrams: { type: 'NUMBER' },
          nutritionPer100g: candidateSchema.properties.nutritionPer100g,
          confidence: { type: 'NUMBER' },
          reason: { type: 'STRING' },
        },
        required: [
          'id',
          'canonicalName',
          'displayName',
          'estimatedGrams',
          'nutritionPer100g',
          'confidence',
          'reason',
        ],
      },
    },
  },
  required: ['name', 'mealType', 'plateRegion', 'foodRegions', 'hiddenIngredientSuggestions'],
};
const coverageSchema = {
  type: 'OBJECT',
  properties: {
    complete: { type: 'BOOLEAN' },
    missingRegions: { type: 'ARRAY', items: regionSchema },
    duplicateRegionIds: { type: 'ARRAY', items: { type: 'STRING' } },
    inconsistentReferences: { type: 'ARRAY', items: { type: 'STRING' } },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['complete', 'missingRegions', 'duplicateRegionIds', 'inconsistentReferences', 'notes'],
};
const nutritionEnrichmentSchema = {
  type: 'OBJECT',
  properties: {
    regions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          regionId: { type: 'STRING' },
          candidates: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                candidateId: { type: 'STRING' },
                estimatedGrams: { type: 'NUMBER' },
                nutritionPer100g: {
                  type: 'OBJECT',
                  properties: {
                    calories: { type: 'NUMBER' },
                    protein: { type: 'NUMBER' },
                    carbs: { type: 'NUMBER' },
                    fat: { type: 'NUMBER' },
                  },
                  required: ['calories', 'protein', 'carbs', 'fat'],
                },
              },
              required: ['candidateId', 'estimatedGrams', 'nutritionPer100g'],
            },
          },
        },
        required: ['regionId', 'candidates'],
      },
    },
  },
  required: ['regions'],
};
const uncertaintyQuestionSchema = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    regionId: { type: 'STRING' },
    kind: { type: 'STRING', enum: ['ingredient', 'portion', 'hidden'] },
    prompt: { type: 'STRING' },
    reason: { type: 'STRING' },
    options: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          label: { type: 'STRING' },
          candidateId: { type: 'STRING' },
          grams: { type: 'NUMBER' },
        },
        required: ['id', 'label'],
      },
    },
  },
  required: ['id', 'kind', 'prompt', 'reason', 'options'],
};

// Requests strict JSON that the application can parse instead of free-form model text.
async function requestGemini(
  apiKey: string,
  parts: Array<Record<string, unknown>>,
  schema: unknown,
): Promise<unknown> {
  const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.find(
    (part: { text?: string }) => part.text,
  )?.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return JSON.parse(text);
}
function normalizeCandidate(raw: Record<string, unknown>, index: number): FoodCandidate {
  return {
    id: String(raw.id ?? `candidate-${index}`),
    canonicalName: String(raw.canonicalName ?? raw.displayName ?? 'unknown'),
    displayName: localizeFoodName(
      String(raw.displayName ?? raw.canonicalName ?? 'Bilinmeyen malzeme'),
    ),
    confidence: Math.min(1, Math.max(0, number(raw.confidence, 0.5))),
    estimatedGrams: Math.max(0, number(raw.estimatedGrams)),
    nutritionPer100g: nutrition(raw.nutritionPer100g as Record<string, unknown> | undefined),
  };
}
function normalizeRegion(raw: Record<string, unknown>, index: number): FoodRegion {
  const candidates = Array.isArray(raw.candidates)
    ? raw.candidates.map((candidate, candidateIndex) =>
        normalizeCandidate(candidate as Record<string, unknown>, candidateIndex),
      )
    : [];
  const status = raw.status === 'recognized' || raw.status === 'ambiguous' ? raw.status : 'unknown';
  return {
    id: String(raw.id ?? `region-${index}`),
    boundingBox: box(raw.boundingBox as Record<string, unknown> | undefined),
    anchor: point(raw.anchor as Record<string, unknown> | undefined),
    status,
    selectedCandidateId:
      typeof raw.selectedCandidateId === 'string'
        ? raw.selectedCandidateId
        : status === 'recognized'
          ? candidates[0]?.id
          : undefined,
    candidates,
  };
}
function normalizeHidden(raw: Record<string, unknown>, index: number): HiddenIngredientSuggestion {
  return {
    id: String(raw.id ?? `hidden-${index}`),
    canonicalName: String(raw.canonicalName ?? raw.displayName ?? 'unknown'),
    displayName: localizeFoodName(
      String(raw.displayName ?? raw.canonicalName ?? 'Bilinmeyen malzeme'),
    ),
    estimatedGrams: Math.max(0, number(raw.estimatedGrams)),
    nutritionPer100g: nutrition(raw.nutritionPer100g as Record<string, unknown> | undefined),
    confidence: Math.min(1, Math.max(0, number(raw.confidence, 0.5))),
    reason: String(raw.reason ?? ''),
  };
}
function normalizeInventory(raw: unknown): VisualMealAnalysis {
  const parsed = VisualMealAnalysisSchema.parse(raw);
  const plateRegion = box(parsed.plateRegion);
  const uncertaintyQuestions: UncertaintyQuestion[] = (parsed.uncertaintyQuestions ?? []).map(
    (question) => ({ ...question, options: question.options.map((option) => ({ ...option })) }),
  );
  return {
    name: localizeMealName(parsed.name),
    mealType: parsed.mealType,
    plateRegion,
    foodRegions: parsed.foodRegions
      .map((region, index) => normalizeRegion(region as unknown as Record<string, unknown>, index))
      .filter((region) => isRegionInsidePlate(region, plateRegion)),
    hiddenIngredientSuggestions: parsed.hiddenIngredientSuggestions.map((item, index) =>
      normalizeHidden(item as unknown as Record<string, unknown>, index),
    ),
    uncertaintyQuestions,
  };
}
// Extracts visible regions before nutrition calculation and verifies coverage with a second AI pass.
async function runTwoPassAnalysis(
  apiKey: string,
  imageBase64: string | undefined,
  mimeType: string,
  description: string | undefined,
  context?: MealContext,
): Promise<{ inventory: VisualMealAnalysis; verification: CoverageVerification }> {
  let correctionNote = '';
  let lastInventory: VisualMealAnalysis | undefined;
  let lastVerification: CoverageVerification | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const inventoryParts: Array<Record<string, unknown>> = [
      {
        text: `PASS 1 — VISIBLE FOOD INVENTORY AND UNCERTAINTY. Inspect the entire plate before nutrition. Identify every distinct substantial visible food region: protein, starch/grain, vegetables, sides, separable sauces, meaningful garnish, and unknown food. Focus only inside the plate; ignore monitor, desk, cables and background. One region exactly once; competing labels for the same pixels must be candidates inside that region. Never hide visible food as a hiddenIngredientSuggestion. Do not make final calorie totals in this pass; estimatedGrams and nutritionPer100g are provisional placeholders for schema compatibility and will be replaced only after coverage verification. After inventory, return at most three uncertaintyQuestions, and only for visible-region uncertainty that materially changes calories or macros: ingredient identity or portion size. Ask the smallest useful question with 2–5 concrete options. Do not ask about high-confidence items. Each visible-region question must reference its regionId and candidateId or grams. Put invisible possibilities such as cooking oil in hiddenIngredientSuggestions instead of asking an unanswered question. Return strict JSON with normalized coordinates. ${description?.trim() ? `User description: ${description.trim()}` : ''} ${mealContextPrompt(context)} ${correctionNote}`,
      },
    ];
    if (imageBase64)
      inventoryParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    lastInventory = normalizeInventory(
      await requestGemini(apiKey, inventoryParts, inventorySchema),
    );
    const verifierParts: Array<Record<string, unknown>> = [
      {
        text: `PASS 2 — COVERAGE VERIFIER. Inspect the image and the inventory JSON below. The input may be a direct meal photo or a test photo of a meal displayed on a computer screen. In either case, inspect the food image/content itself and ignore the surrounding monitor frame, keyboard, desk, cables, and unrelated background. Check every substantial visible food area, especially the main protein and starch. Check whether explanations mention visible food missing from foodRegions, whether two different regions overlap as duplicates, and whether background objects were classified as food. Return strict JSON only. Inventory: ${JSON.stringify(lastInventory)}. ${correctionNote}`,
      },
    ];
    if (imageBase64)
      verifierParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    lastVerification = CoverageVerificationSchema.parse(
      await requestGemini(apiKey, verifierParts, coverageSchema),
    );
    const duplicates = [
      ...new Set([
        ...lastVerification.duplicateRegionIds,
        ...duplicateRegionIds(lastInventory.foodRegions),
      ]),
    ];
    if (!coverageNeedsRetry(lastInventory, { ...lastVerification, duplicateRegionIds: duplicates }))
      return { inventory: lastInventory, verification: lastVerification };
    correctionNote = `Previous verifier findings must be fixed: missing=${JSON.stringify(lastVerification.missingRegions)}, duplicates=${JSON.stringify(duplicates)}, inconsistent=${JSON.stringify(lastVerification.inconsistentReferences)}, notes=${JSON.stringify(lastVerification.notes)}.`;
  }
  if (!lastInventory || !lastVerification)
    throw new Error('Coverage pipeline did not return a result');
  const merged = mergeMissingRegions(lastInventory, lastVerification);
  const duplicates = [
    ...new Set([...lastVerification.duplicateRegionIds, ...duplicateRegionIds(merged)]),
  ];
  return {
    inventory: { ...lastInventory, foodRegions: merged },
    verification: {
      ...lastVerification,
      complete:
        lastVerification.complete &&
        !duplicates.length &&
        !lastVerification.inconsistentReferences.length,
      duplicateRegionIds: duplicates,
    },
  };
}

// After coverage is verified, requests grams and nutrition only for existing regions and candidates.
async function enrichVerifiedNutrition(
  apiKey: string,
  imageBase64: string | undefined,
  mimeType: string,
  inventory: VisualMealAnalysis,
  description?: string,
): Promise<VisualMealAnalysis> {
  const parts: Array<Record<string, unknown>> = [
    {
      text: `PASS 3 — VERIFIED PORTION AND NUTRITION ENRICHMENT. Coverage has already been verified. Do not discover, remove, merge, or invent regions. Use exactly the regionIds and candidateIds from the verified inventory. Estimate grams and nutritionPer100g for each candidate. Nutrition is an estimate, not a medical measurement. Return strict JSON only. Verified inventory: ${JSON.stringify(inventory)}. ${description?.trim() ? `User description: ${description.trim()}` : ''}`,
    },
  ];
  if (imageBase64) parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
  const raw = (await requestGemini(apiKey, parts, nutritionEnrichmentSchema)) as {
    regions?: Array<{
      regionId: string;
      candidates?: Array<{
        candidateId: string;
        estimatedGrams: number;
        nutritionPer100g: Record<string, unknown>;
      }>;
    }>;
  };
  const enrichments = new Map((raw.regions ?? []).map((region) => [region.regionId, region]));
  return {
    ...inventory,
    foodRegions: inventory.foodRegions.map((region) => {
      const enrichment = enrichments.get(region.id);
      if (!enrichment) return region;
      const values = new Map(
        (enrichment.candidates ?? []).map((candidate) => [candidate.candidateId, candidate]),
      );
      return {
        ...region,
        candidates: region.candidates.map((candidate) => {
          const value = values.get(candidate.id);
          return value
            ? {
                ...candidate,
                estimatedGrams: Math.max(0, number(value.estimatedGrams, candidate.estimatedGrams)),
                nutritionPer100g: nutrition(value.nutritionPer100g),
              }
            : candidate;
        }),
      };
    }),
  };
}

// Main analysis entry point; preserves the demo flow with a mock result when real AI is unavailable.
export async function analyzeMeal(
  imageUri?: string,
  description?: string,
  imageBase64?: string,
  mimeType = 'image/jpeg',
  context?: MealContext,
): Promise<DraftMeal> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    const mock = await analyzeMockMeal(imageUri, description);
    return context ? { ...mock, mealType: context.mealType } : mock;
  }
  try {
    const result = await runTwoPassAnalysis(apiKey, imageBase64, mimeType, description, context);
    let enrichedInventory = result.inventory;
    try {
      enrichedInventory = await enrichVerifiedNutrition(
        apiKey,
        imageBase64,
        mimeType,
        result.inventory,
        description,
      );
    } catch (enrichmentError) {
      console.warn(
        'Nutrition enrichment failed; retaining provisional candidate values.',
        enrichmentError,
      );
    }
    const foodRegions = applyControlledNutrition(enrichedInventory.foodRegions);
    const items = regionsToMealItems(foodRegions);
    return {
      name: enrichedInventory.name,
      imageUri,
      mealType: context?.mealType ?? enrichedInventory.mealType,
      plateRegion: enrichedInventory.plateRegion,
      foodRegions,
      initialFoodRegions: foodRegions,
      hiddenIngredientSuggestions: enrichedInventory.hiddenIngredientSuggestions,
      uncertaintyQuestions: enrichedInventory.uncertaintyQuestions,
      coverageComplete: result.verification.complete,
      coverageNotes: [...result.verification.notes, ...result.verification.inconsistentReferences],
      items,
      initialItems: items.map((item) => ({ ...item })),
      suggestions: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Two-pass meal analysis failed; using mock fallback.', message);
    if (__DEV__) Alert.alert('Gemini debug', `${message}\n\nMock result gösteriliyor.`);
    return analyzeMockMeal(imageUri, description);
  }
}
// Real visual AI pipeline: extracts visible regions, verifies coverage, enriches nutrition, and normalizes the result.
