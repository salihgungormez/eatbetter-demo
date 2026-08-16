import assert from 'node:assert/strict';
import { applyControlledNutrition, calculateNutrition } from '@/services/nutrition';
import { FoodRegion } from '@/types/meal';

const region = (id: string, name: string, selected = true): FoodRegion => ({
  id,
  boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  anchor: { x: 0.2, y: 0.2 },
  status: selected ? 'recognized' : 'ambiguous',
  selectedCandidateId: selected ? `${id}-candidate` : undefined,
  candidates: [{ id: `${id}-candidate`, canonicalName: name, displayName: name, confidence: 0.9, estimatedGrams: 100, nutritionPer100g: { calories: 999, protein: 0, carbs: 0, fat: 0 } }],
});

const enriched = applyControlledNutrition([region('rice', 'rice'), region('chicken', 'chicken')]);
assert.equal(enriched[0].candidates[0].nutritionPer100g.calories, 130, 'known food uses controlled nutrition');
assert.equal(calculateNutrition(enriched).calories, 295, 'only selected verified regions contribute');
assert.equal(calculateNutrition(applyControlledNutrition([region('unknown', 'unknown', false)])).calories, 0, 'ambiguous region is not silently counted');
console.log('nutrition pipeline: ok');
// Verifies that controlled nutrition totals are correct after coverage validation.
