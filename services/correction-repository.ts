import AsyncStorage from '@react-native-async-storage/async-storage';
import { IngredientCorrection } from '@/services/correction-memory';

export interface CorrectionRepository {
  load(): Promise<IngredientCorrection[]>;
  append(records: IngredientCorrection[]): Promise<IngredientCorrection[]>;
}
export const serializeCorrections = (records: IngredientCorrection[]) => JSON.stringify(records);
export const parseCorrections = (value: string | null): IngredientCorrection[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
// Creates a repository so the UI does not need to know AsyncStorage implementation details.
export function createCorrectionRepository(storage = AsyncStorage): CorrectionRepository {
  const key = 'eatbetter.corrections.v1';
  return {
    async load() {
      return parseCorrections(await storage.getItem(key));
    },
    async append(records) {
      const current = await this.load();
      const next = [...current, ...records];
      await storage.setItem(key, serializeCorrections(next));
      return next;
    },
  };
}
// Persistence abstraction for Correction Memory records; it uses device storage today and can support a backend later.
