import { FoodRegion } from '@/types/meal';

export type IngredientCorrection = {
  id: string;
  createdAt: string;
  mealType?: string;
  originalCandidates: Array<{ canonicalName: string; confidence: number }>;
  originalSelection?: string;
  correctedSelection: string;
  originalGrams?: number;
  correctedGrams?: number;
};
export type PersonalizedCandidate = {
  canonicalName: string;
  visualConfidence: number;
  memoryBoost: number;
  finalScore: number;
  influencedByMemory: boolean;
};
export type PersonalizationDiagnostic = {
  regionId: string;
  originalRanking: PersonalizedCandidate[];
  appliedRecords: IngredientCorrection[];
  finalRanking: PersonalizedCandidate[];
  changed: boolean;
};
export const MEMORY_BOOST_CAP = 0.12;

export function normalizeIngredientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
const candidateName = (region: FoodRegion, id?: string) =>
  region.candidates.find((candidate) => candidate.id === id)?.canonicalName;

// Stores meaningful differences confirmed when the user saves, not temporary editor selections.
export function buildCorrections(
  initialRegions: FoodRegion[],
  finalRegions: FoodRegion[],
  mealType?: string,
  createdAt = new Date().toISOString(),
): IngredientCorrection[] {
  const records: IngredientCorrection[] = [];
  for (const finalRegion of finalRegions) {
    const initial = initialRegions.find((region) => region.id === finalRegion.id);
    const corrected = candidateName(finalRegion, finalRegion.selectedCandidateId);
    const original = candidateName(initial ?? finalRegion, initial?.selectedCandidateId);
    if (
      !corrected ||
      (corrected === original &&
        initial?.candidates.find((item) => item.id === initial.selectedCandidateId)
          ?.estimatedGrams ===
          finalRegion.candidates.find((item) => item.id === finalRegion.selectedCandidateId)
            ?.estimatedGrams)
    )
      continue;
    const selectedInitialCandidate = initial?.candidates.find(
      (item) => item.id === initial.selectedCandidateId,
    );
    const selectedFinalCandidate = finalRegion.candidates.find(
      (item) => item.id === finalRegion.selectedCandidateId,
    );
    records.push({
      id: `correction-${finalRegion.id}-${Date.now()}-${records.length}`,
      createdAt,
      mealType,
      originalCandidates: (initial ?? finalRegion).candidates.map((candidate) => ({
        canonicalName: normalizeIngredientName(candidate.canonicalName),
        confidence: candidate.confidence,
      })),
      originalSelection: original ? normalizeIngredientName(original) : undefined,
      correctedSelection: normalizeIngredientName(corrected),
      originalGrams: selectedInitialCandidate?.estimatedGrams,
      correctedGrams: selectedFinalCandidate?.estimatedGrams,
    });
  }
  return records;
}

function eligible(region: FoodRegion): boolean {
  const ranked = [...region.candidates].sort((a, b) => b.confidence - a.confidence);
  return (
    region.status === 'ambiguous' ||
    (ranked[0]?.confidence ?? 0) < 0.65 ||
    (ranked[0]?.confidence ?? 0) - (ranked[1]?.confidence ?? 0) < 0.12
  );
}
function matchingRecords(
  region: FoodRegion,
  corrections: IngredientCorrection[],
): IngredientCorrection[] {
  const names = new Set(
    region.candidates.map((candidate) => normalizeIngredientName(candidate.canonicalName)),
  );
  return corrections.filter((record) => {
    const overlap = record.originalCandidates.filter((candidate) =>
      names.has(candidate.canonicalName),
    ).length;
    return (
      overlap >= Math.min(2, record.originalCandidates.length) &&
      names.has(record.correctedSelection)
    );
  });
}

// Personalizes ambiguous candidates with a capped boost from previous corrections.
export function personalizeRegions(
  regions: FoodRegion[],
  corrections: IngredientCorrection[],
): { regions: FoodRegion[]; diagnostics: PersonalizationDiagnostic[] } {
  const diagnostics: PersonalizationDiagnostic[] = [];
  const personalized = regions.map((region) => {
    const originalRanking = region.candidates
      .map((candidate) => ({
        canonicalName: candidate.canonicalName,
        visualConfidence: candidate.confidence,
        memoryBoost: 0,
        finalScore: candidate.confidence,
        influencedByMemory: false,
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
    const records = eligible(region) ? matchingRecords(region, corrections) : [];
    const counts = new Map<string, number>();
    records.forEach((record) =>
      counts.set(record.correctedSelection, (counts.get(record.correctedSelection) ?? 0) + 1),
    );
    const reranked = region.candidates
      .map((candidate) => {
        const count = counts.get(normalizeIngredientName(candidate.canonicalName)) ?? 0;
        const boost = Math.min(MEMORY_BOOST_CAP, count ? 0.05 + Math.max(0, count - 1) * 0.03 : 0);
        return { candidate, boost, score: candidate.confidence + boost };
      })
      .sort((a, b) => b.score - a.score);
    const finalRanking = reranked.map((entry) => ({
      canonicalName: entry.candidate.canonicalName,
      visualConfidence: entry.candidate.confidence,
      memoryBoost: entry.boost,
      finalScore: entry.score,
      influencedByMemory: entry.boost > 0,
    }));
    const changed =
      finalRanking[0]?.canonicalName !== originalRanking[0]?.canonicalName &&
      finalRanking[0]?.influencedByMemory === true;
    diagnostics.push({
      regionId: region.id,
      originalRanking,
      appliedRecords: records,
      finalRanking,
      changed,
    });
    return {
      ...region,
      candidates: reranked.map((entry) => entry.candidate),
      memoryRecommendation:
        changed || finalRanking[0]?.influencedByMemory
          ? { candidateId: reranked[0]?.candidate.id, boost: reranked[0]?.boost }
          : undefined,
    };
  });
  return { regions: personalized, diagnostics };
}
// Uses saved corrections as a personal prior without overriding strong visual evidence.
