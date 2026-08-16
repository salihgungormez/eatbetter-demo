import assert from 'node:assert/strict';
import { coverageNeedsRetry, duplicateRegionIds, mergeMissingRegions } from '@/utils/coverage';
import { CoverageVerification } from '@/types/visual-meal-analysis';
import { FoodRegion } from '@/types/meal';
import { isRegionInsidePlate, regionTotals, selectCandidate } from '@/utils/food-regions';

const food = (id: string, x: number, y: number, status: FoodRegion['status'] = 'recognized'): FoodRegion => ({ id, boundingBox: { x, y, width: 0.16, height: 0.14 }, anchor: { x: x + 0.08, y: y + 0.07 }, status, selectedCandidateId: status === 'recognized' ? id : undefined, candidates: [{ id, canonicalName: id, displayName: id, confidence: 0.9, estimatedGrams: 100, nutritionPer100g: { calories: 100, protein: 10, carbs: 10, fat: 2 } }] });
const inventory = { name: 'Karışık tabak', mealType: 'lunch' as const, plateRegion: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }, foodRegions: [food('broccoli', 0.1, 0.1), food('lemon', 0.7, 0.1)], hiddenIngredientSuggestions: [{ id: 'oil', canonicalName: 'olive oil', displayName: 'Zeytinyağı', confidence: 0.42, estimatedGrams: 5, nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 }, reason: 'Yüzeyde görünmeyen pişirme yağı olabilir' }] };
const missing = [food('rice', 0.2, 0.55), food('potatoes', 0.45, 0.55), food('chicken', 0.68, 0.55)];
const incomplete: CoverageVerification = { complete: false, missingRegions: missing, duplicateRegionIds: [], inconsistentReferences: ['Visible chicken mentioned but absent from foodRegions'], notes: ['Main protein and starch are uncovered'] };
const merged = mergeMissingRegions(inventory, incomplete);
assert.equal(merged.length, 5, 'mixed five-item plate merges missing visible regions');
assert.equal(coverageNeedsRetry(inventory, incomplete), true, 'missing visible food triggers retry');
const singleItem = { ...inventory, foodRegions: [food('soup', 0.35, 0.35)], hiddenIngredientSuggestions: [] };
assert.equal(coverageNeedsRetry(singleItem, { complete: true, missingRegions: [], duplicateRegionIds: [], inconsistentReferences: [], notes: [] }), false, 'genuinely single-item meal passes coverage');
assert.equal(isRegionInsidePlate(food('background', 0.95, 0.95), inventory.plateRegion), false, 'background outside plate is ignored');
assert.equal(inventory.foodRegions.some((region) => region.id === 'oil'), false, 'hidden oil stays a suggestion and is not a visible region');
const unknown = food('unknown-food', 0.35, 0.35, 'unknown');
assert.equal(unknown.status, 'unknown', 'unknown visible food remains a region');
const duplicate = [food('a', 0.2, 0.2), { ...food('b', 0.2, 0.2), candidates: [food('b', 0.2, 0.2).candidates[0]] }];
assert.equal(duplicateRegionIds(duplicate).length, 2, 'duplicate visual regions are detected');
assert.equal(coverageNeedsRetry({ ...inventory, foodRegions: duplicate }, { complete: true, missingRegions: [], duplicateRegionIds: [], inconsistentReferences: [], notes: [] }), true, 'duplicate regions fail consistency validation');
assert.equal(regionTotals([food('rice', 0.2, 0.2), unknown]).calories, 100, 'unresolved unknown region is not counted as selected nutrition');
assert.equal(regionTotals([selectCandidate(unknown, 'not-found')]).calories, 0, 'unknown region cannot silently contribute nutrition');
console.log('coverage pipeline: ok');
// Verifies visible food coverage, unknown regions, and duplicate-region checks.
