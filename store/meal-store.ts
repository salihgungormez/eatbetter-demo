import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DraftMeal, Meal } from '@/types/meal';
import { IngredientCorrection } from '@/services/correction-memory';
import { createCorrectionRepository } from '@/services/correction-repository';
const STORAGE_KEY = 'eatbetter.meals.v1';
const correctionRepository = createCorrectionRepository();
type MealStore = {
  meals: Meal[];
  corrections: IngredientCorrection[];
  hydrated: boolean;
  pendingImageBase64?: string;
  pendingMimeType?: string;
  setPendingImage: (base64?: string, mimeType?: string) => void;
  hydrate: () => Promise<void>;
  addCorrections: (records: IngredientCorrection[]) => Promise<void>;
  saveMeal: (draft: DraftMeal) => Promise<Meal>;
};
export const useMealStore = create<MealStore>((set, get) => ({
  meals: [],
  corrections: [],
  hydrated: false,
  pendingImageBase64: undefined,
  pendingMimeType: undefined,
  setPendingImage: (pendingImageBase64, pendingMimeType) =>
    set({ pendingImageBase64, pendingMimeType }),
  // Restores meal and correction history from device storage when the app starts.
  hydrate: async () => {
    try {
      const [stored, corrections] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        correctionRepository.load(),
      ]);
      set({ meals: stored ? JSON.parse(stored) : [], corrections, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  addCorrections: async (records) => {
    if (!records.length) return;
    const corrections = await correctionRepository.append(records);
    set({ corrections });
  },
  // Persists a meal only after the user confirms it on the review screen.
  saveMeal: async (draft) => {
    const meal: Meal = { ...draft, id: `meal-${Date.now()}`, createdAt: new Date().toISOString() };
    const meals = [meal, ...get().meals];
    set({ meals });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
    return meal;
  },
}));
// Zustand store: manages draft and saved meals plus correction records with AsyncStorage.
