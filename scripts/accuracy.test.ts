import assert from 'node:assert/strict';
import { calorieRangeReduction, rankClarificationQuestions } from '@/utils/accuracy';
import { calculateCalloutLayout, mapNormalizedRegionToImage, visualRegionAnchor } from '@/utils/visual-review';

const box = mapNormalizedRegionToImage({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, { x: 50, y: 0, width: 400, height: 500 });
assert.deepEqual(box, { x: 150, y: 125, width: 200, height: 250 });
const layout = calculateCalloutLayout([{ id: 'a', anchor: { x: 0.2, y: 0.1 } }, { id: 'b', anchor: { x: 0.2, y: 0.11 } }, { id: 'c', anchor: { x: 0.8, y: 0.2 } }], { width: 500, height: 300 }, { x: 0, y: 0, width: 500, height: 300 });
assert.equal(layout.length, 3, 'anchored ingredients should receive callouts');
assert.ok((layout.find((item) => item.id === 'a')?.cardY ?? 0) + 62 <= (layout.find((item) => item.id === 'b')?.cardY ?? 0), 'left callouts should not overlap');
assert.deepEqual(
  visualRegionAnchor({ boundingBox: { x: 0.3, y: 0.2, width: 0.2, height: 0.4 }, anchor: { x: 0.9, y: 0.9 } }),
  { x: 0.4, y: 0.4 },
  'rendered markers should use the visual region center instead of a drifting model anchor',
);

const questions = [{ id: 'oil', question: 'Yağ kullandın mı?', reason: '', expectedCalorieImpact: 180, options: [] }, { id: 'tomato', question: 'Domates kaç gram?', reason: '', expectedCalorieImpact: 8, options: [] }, { id: 'cheese', question: 'Kaşar var mı?', reason: '', expectedCalorieImpact: 120, options: [] }];
assert.deepEqual(rankClarificationQuestions(questions).map((question) => question.id), ['oil', 'cheese']);
assert.equal(calorieRangeReduction({ min: 720, max: 1180 }, { min: 860, max: 970 }).percentage, 76);
console.log('accuracy utilities: ok');
// Verifies visual callout placement and core accuracy helpers.
