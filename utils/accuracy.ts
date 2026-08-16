import { FinalMealAnalysis } from '@/types/analysis';
import { MealItem } from '@/types/meal';

export function recalculateTotals(items: MealItem[]) { return items.reduce((totals, item) => ({ calories: totals.calories + item.calories, protein: totals.protein + item.protein, carbs: totals.carbs + item.carbs, fat: totals.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }); }
export function rankClarificationQuestions(questions: FinalMealAnalysis['clarificationQuestions']) { return [...questions].sort((a, b) => b.expectedCalorieImpact - a.expectedCalorieImpact).slice(0, 2); }
export function calorieRangeReduction(before: { min: number; max: number }, after: { min: number; max: number }) { const beforeWidth = Math.max(0, before.max - before.min); const afterWidth = Math.max(0, after.max - after.min); return { beforeWidth, afterWidth, percentage: beforeWidth === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((beforeWidth - afterWidth) / beforeWidth) * 100))) }; }
// Helpers that make analysis results and nutrition totals reproducible in tests.
