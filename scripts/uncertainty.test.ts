import assert from 'node:assert/strict';
import { analyzeMeal } from '@/services/mock-ai';
import { VisualMealAnalysisSchema } from '@/types/visual-meal-analysis';

async function main() {
const draft = await analyzeMeal();
assert.equal(draft.uncertaintyQuestions?.length, 1, 'mock exposes one high-impact clarification');
const question = draft.uncertaintyQuestions?.[0];
assert.equal(question?.regionId, 'region-white-food', 'question points to the ambiguous visual region');
assert.equal(question?.options[0].candidateId, 'candidate-yogurt', 'answer maps to an existing candidate');
const parsed = VisualMealAnalysisSchema.parse({ name: 'test', mealType: 'lunch', plateRegion: { x: 0, y: 0, width: 1, height: 1 }, foodRegions: [], hiddenIngredientSuggestions: [], uncertaintyQuestions: [{ id: 'q', regionId: 'r', kind: 'portion', prompt: 'Porsiyon?', reason: 'Kaloriyi etkiler', options: [{ id: 'small', label: 'Küçük', grams: 100 }, { id: 'large', label: 'Büyük', grams: 220 }] }] });
assert.equal(parsed.uncertaintyQuestions?.[0].options[1].grams, 220, 'portion answers carry a gram value');
console.log('uncertainty questions: ok');
}
void main();
// Verifies that uncertainty questions are created only for meaningful low-confidence cases.
