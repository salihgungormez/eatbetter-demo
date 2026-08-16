import assert from 'node:assert/strict';
import { assignUnknownRegion, isRegionInsidePlate, regionTotals, selectCandidate } from '@/utils/food-regions';
import { FoodRegion } from '@/types/meal';
import { calculateCalloutLayout } from '@/utils/visual-review';

const region: FoodRegion = { id: 'white-food', boundingBox: { x: 0.2, y: 0.3, width: 0.3, height: 0.2 }, anchor: { x: 0.35, y: 0.4 }, status: 'ambiguous', candidates: [
  { id: 'lor', canonicalName: 'curd-cheese', displayName: 'Lor peyniri', confidence: 0.41, estimatedGrams: 100, nutritionPer100g: { calories: 98, protein: 11, carbs: 3, fat: 4 } },
  { id: 'yogurt', canonicalName: 'yogurt', displayName: 'Yoğurt', confidence: 0.52, estimatedGrams: 100, nutritionPer100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 } },
] };

assert.equal(region.candidates.length, 2, 'alternative hypotheses share one region');
assert.equal(regionTotals([region]).calories, 0, 'ambiguous regions do not contribute before selection');
const yogurtRegion = selectCandidate(region, 'yogurt');
assert.equal(regionTotals([yogurtRegion]).calories, 61, 'switching candidate recalculates totals');
assert.equal(yogurtRegion.boundingBox, region.boundingBox, 'candidate switch preserves region');
const unknown: FoodRegion = { id: 'unknown', boundingBox: { x: 0.6, y: 0.4, width: 0.2, height: 0.2 }, anchor: { x: 0.7, y: 0.5 }, status: 'unknown', candidates: [] };
const assigned = assignUnknownRegion(unknown, { id: 'user-food', canonicalName: 'custom-food', displayName: 'Yeni malzeme', confidence: 1, estimatedGrams: 50, nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
assert.equal(assigned.status, 'recognized');
assert.equal(calculateCalloutLayout([unknown], { width: 400, height: 300 }, { x: 0, y: 0, width: 400, height: 300 }).length, 1, 'unknown region remains selectable');
assert.equal(calculateCalloutLayout([{ id: 'plate-food', boundingBox: region.boundingBox, anchor: region.anchor }], { width: 400, height: 300 }, { x: 0, y: 0, width: 400, height: 300 }).length, 1, 'visible food region gets one callout');
assert.equal(isRegionInsidePlate(region, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }), true, 'food inside plate is retained');
assert.equal(isRegionInsidePlate({ ...region, boundingBox: { x: 0.9, y: 0.9, width: 0.05, height: 0.05 } }, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }), false, 'background region is ignored');
console.log('food region model: ok');
// Verifies alternative candidates within one region and nutrition recalculation.
