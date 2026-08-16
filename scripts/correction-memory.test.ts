import assert from 'node:assert/strict';
import { buildCorrections, MEMORY_BOOST_CAP, personalizeRegions } from '@/services/correction-memory';
import { parseCorrections, serializeCorrections } from '@/services/correction-repository';
import { FoodRegion } from '@/types/meal';
import { regionTotals, selectCandidate } from '@/utils/food-regions';

const candidate = (id: string, confidence: number) => ({ id, canonicalName: id, displayName: id, confidence, estimatedGrams: 100, nutritionPer100g: { calories: id === 'yogurt' ? 61 : 98, protein: 4, carbs: 4, fat: 4 } });
const ambiguous: FoodRegion = { id: 'r1', boundingBox: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 }, anchor: { x: 0.3, y: 0.3 }, status: 'ambiguous', candidates: [candidate('lor', 0.48), candidate('yogurt', 0.44)] };
const selected = selectCandidate(ambiguous, 'yogurt');
const records = buildCorrections([ambiguous], [selected], 'lunch', '2026-01-01T00:00:00.000Z');
assert.equal(records.length, 1, 'correction is created for confirmed save input');
assert.equal(buildCorrections([ambiguous], [ambiguous], 'lunch').length, 0, 'temporary editor state is not saved without a changed selection');

const first = personalizeRegions([ambiguous], records);
assert.equal(first.regions[0].candidates[0].canonicalName, 'yogurt', 'similar ambiguous candidates receive memory reranking');
assert.equal(first.diagnostics[0].appliedRecords.length, 1);
const strong = personalizeRegions([{ ...ambiguous, status: 'recognized', candidates: [candidate('lor', 0.92), candidate('yogurt', 0.08)] }], records);
assert.equal(strong.regions[0].candidates[0].canonicalName, 'lor', 'strong visual evidence is not overridden');
const different = personalizeRegions([{ ...ambiguous, candidates: [candidate('rice', 0.5), candidate('bread', 0.49)] }], records);
assert.equal(different.diagnostics[0].appliedRecords.length, 0, 'different candidate sets are unaffected');
const repeated = personalizeRegions([ambiguous], [...records, ...records, ...records, ...records, ...records]);
assert.equal(repeated.diagnostics[0].finalRanking.find((item) => item.canonicalName === 'yogurt')?.memoryBoost, MEMORY_BOOST_CAP, 'repeated corrections stop at the cap');
assert.equal(regionTotals([ambiguous]).calories, 0, 'unselected candidate contributes nothing');
assert.equal(regionTotals([selected]).calories, 61, 'selected candidate alone affects totals');
assert.deepEqual(parseCorrections(serializeCorrections(records)), JSON.parse(JSON.stringify(records)), 'corrections survive persistence round-trip');
console.log('correction memory: ok');
// Verifies Correction Memory persistence, matching, and capped-boost rules.
