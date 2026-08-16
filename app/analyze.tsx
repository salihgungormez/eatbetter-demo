import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryButton, colors, styles } from '@/components/ui';
import { FoodItemRow } from '@/components/FoodItemRow';
import { SectionLabel } from '@/components/ui';
import { analyzeMeal } from '@/services/ai';
import {
  DraftMeal,
  FoodCandidate,
  FoodRegion,
  NutritionValues,
  UncertaintyQuestion,
} from '@/types/meal';
import { useMealStore } from '@/store/meal-store';
import { candidateNutrition, regionTotals, regionsToMealItems } from '@/utils/food-regions';
import { localizeFoodName } from '@/utils/localization';
import { calculateCalloutLayout } from '@/utils/visual-review';
import {
  buildCorrections,
  personalizeRegions,
  PersonalizationDiagnostic,
} from '@/services/correction-memory';
import { inferMealContext, MealType } from '@/services/meal-context';

const emptyNutrition: NutritionValues = { calories: 0, protein: 0, carbs: 0, fat: 0 };
const cloneRegions = (regions: FoodRegion[]) =>
  regions.map((region) => ({
    ...region,
    boundingBox: { ...region.boundingBox },
    anchor: { ...region.anchor },
    candidates: region.candidates.map((candidate) => ({
      ...candidate,
      nutritionPer100g: { ...candidate.nutritionPer100g },
    })),
  }));

export default function AnalyzeScreen() {
  const params = useLocalSearchParams<{
    imageUri?: string;
    description?: string;
    mealType?: string;
  }>();
  const saveMeal = useMealStore((state) => state.saveMeal);
  const addCorrections = useMealStore((state) => state.addCorrections);
  const hydrate = useMealStore((state) => state.hydrate);
  const corrections = useMealStore((state) => state.corrections);
  const meals = useMealStore((state) => state.meals);
  const hydrated = useMealStore((state) => state.hydrated);
  const pendingImageBase64 = useMealStore((state) => state.pendingImageBase64);
  const pendingMimeType = useMealStore((state) => state.pendingMimeType);
  const [meal, setMeal] = useState<DraftMeal>();
  const [saving, setSaving] = useState(false);
  const [editingRegion, setEditingRegion] = useState<FoodRegion>();
  const [editingCandidateId, setEditingCandidateId] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [editingGrams, setEditingGrams] = useState('');
  const [photoSize, setPhotoSize] = useState({ width: 0, height: 0 });
  const [imageAspect, setImageAspect] = useState(4 / 3);
  const [diagnostics, setDiagnostics] = useState<PersonalizationDiagnostic[]>([]);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const [activeCalloutId, setActiveCalloutId] = useState<string>();
  const [highlightedRegionId, setHighlightedRegionId] = useState<string>();
  const drawerTranslateY = useRef(new Animated.Value(0)).current;
  const window = useWindowDimensions();

  const closeDrawer = () => {
    drawerTranslateY.setValue(0);
    setEditingRegion(undefined);
  };
  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) drawerTranslateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 110 || gesture.vy > 0.9) {
            Animated.timing(drawerTranslateY, {
              toValue: 520,
              duration: 180,
              useNativeDriver: true,
            }).start(() => closeDrawer());
            return;
          }
          Animated.spring(drawerTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [drawerTranslateY],
  );

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
      return;
    }
    let cancelled = false;
    const inferred = inferMealContext(new Date(), meals);
    const context = params.mealType
      ? { ...inferred, mealType: params.mealType as MealType }
      : inferred;
    analyzeMeal(
      params.imageUri,
      params.description,
      pendingImageBase64,
      pendingMimeType,
      context,
    ).then((result) => {
      if (cancelled) return;
      const personalized = personalizeRegions(result.foodRegions ?? [], corrections);
      setDiagnostics(personalized.diagnostics);
      setMeal({
        ...result,
        foodRegions: personalized.regions,
        initialFoodRegions: cloneRegions(result.initialFoodRegions ?? result.foodRegions ?? []),
        items: regionsToMealItems(personalized.regions),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    hydrate,
    corrections,
    meals,
    params.imageUri,
    params.description,
    params.mealType,
    pendingImageBase64,
    pendingMimeType,
  ]);
  const regions = meal?.foodRegions ?? [];
  const totals = useMemo(() => regionTotals(regions), [regions]);
  const confidence = useMemo(() => {
    const selected = regions.map((region) =>
      region.candidates.find((candidate) => candidate.id === region.selectedCandidateId),
    );
    const values = selected.filter(Boolean).map((candidate) => candidate?.confidence ?? 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.35;
  }, [regions]);
  const imageRect = useMemo(() => {
    if (!photoSize.width || !photoSize.height)
      return { x: 0, y: 0, width: photoSize.width, height: photoSize.height };
    const height = photoSize.width / imageAspect;
    if (height <= photoSize.height)
      return { x: 0, y: (photoSize.height - height) / 2, width: photoSize.width, height };
    const width = photoSize.height * imageAspect;
    return { x: (photoSize.width - width) / 2, y: 0, width, height: photoSize.height };
  }, [photoSize, imageAspect]);
  useEffect(() => {
    if (regions.length && !regions.some((region) => region.id === activeCalloutId))
      setActiveCalloutId(regions[0].id);
  }, [regions, activeCalloutId]);
  const callouts = useMemo(
    () =>
      calculateCalloutLayout(
        regions.filter((region) => region.id === activeCalloutId),
        photoSize,
        imageRect,
        138,
        62,
      ),
    [regions, activeCalloutId, photoSize, imageRect],
  );
  if (!meal)
    return (
      <View
        style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 30 }]}
      >
        <ActivityIndicator color={colors.ink} size="large" />
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 22 }}>
          Öğünün okunuyor…
        </Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>
          Görünen yiyecek bölgelerini ayırıyoruz.
        </Text>
      </View>
    );

  const openEditor = (region: FoodRegion) => {
    const candidate =
      region.candidates.find((item) => item.id === region.selectedCandidateId) ??
      region.candidates[0];
    drawerTranslateY.setValue(0);
    setEditingRegion(region);
    setEditingCandidateId(region.selectedCandidateId ?? candidate?.id);
    setEditingName(candidate ? localizeFoodName(candidate.displayName) : '');
    setEditingGrams(String(candidate?.estimatedGrams ?? 50));
  };
  const applyRegionEdit = () => {
    if (!editingRegion) return;
    let candidate = editingRegion.candidates.find((item) => item.id === editingCandidateId);
    if (!candidate && editingName.trim())
      candidate = {
        id: `user-candidate-${Date.now()}`,
        canonicalName: editingName.trim().toLowerCase().replace(/\s+/g, '-'),
        displayName: editingName.trim(),
        confidence: 1,
        estimatedGrams: Number(editingGrams) || 50,
        nutritionPer100g: emptyNutrition,
      };
    if (!candidate) return;
    const updatedCandidate = {
      ...candidate,
      displayName: editingName.trim() || candidate.displayName,
      estimatedGrams: Math.max(0, Number(editingGrams) || candidate.estimatedGrams),
    };
    const updatedRegions = regions.map((region) =>
      region.id !== editingRegion.id
        ? region
        : {
            ...region,
            status: 'recognized' as const,
            selectedCandidateId: updatedCandidate.id,
            candidates: region.candidates.some((item) => item.id === updatedCandidate.id)
              ? region.candidates.map((item) =>
                  item.id === updatedCandidate.id ? updatedCandidate : item,
                )
              : [...region.candidates, updatedCandidate],
          },
    );
    setMeal({
      ...meal,
      foodRegions: updatedRegions,
      items: regionsToMealItems(updatedRegions),
      initialItems: meal.initialItems ?? regionsToMealItems(regions),
    });
    setEditingRegion(undefined);
  };
  const answerQuestion = (
    question: UncertaintyQuestion,
    option: UncertaintyQuestion['options'][number],
  ) => {
    if (!meal || !question.regionId) {
      setAnsweredQuestionIds((current) =>
        current.includes(question.id) ? current : [...current, question.id],
      );
      return;
    }
    if (!option.candidateId && option.grams == null) {
      const region = regions.find((item) => item.id === question.regionId);
      if (region) openEditor(region);
      return;
    }
    const updatedRegions = regions.map((region) => {
      if (region.id !== question.regionId) return region;
      const candidateId = option.candidateId ?? region.selectedCandidateId;
      const candidates =
        option.grams == null
          ? region.candidates
          : region.candidates.map((candidate) =>
              candidate.id === candidateId
                ? {
                    ...candidate,
                    estimatedGrams: Math.max(0, option.grams ?? candidate.estimatedGrams),
                  }
                : candidate,
            );
      return {
        ...region,
        status: 'recognized' as const,
        selectedCandidateId: candidateId,
        candidates,
      };
    });
    setMeal({ ...meal, foodRegions: updatedRegions, items: regionsToMealItems(updatedRegions) });
    setAnsweredQuestionIds((current) =>
      current.includes(question.id) ? current : [...current, question.id],
    );
  };
  const removeRegion = () => {
    if (!editingRegion) return;
    const updatedRegions = regions.filter((region) => region.id !== editingRegion.id);
    setMeal({ ...meal, foodRegions: updatedRegions, items: regionsToMealItems(updatedRegions) });
    setEditingRegion(undefined);
  };
  const removeRegionById = (regionId: string) => {
    const updatedRegions = regions.filter((region) => region.id !== regionId);
    setMeal({ ...meal, foodRegions: updatedRegions, items: regionsToMealItems(updatedRegions) });
    if (activeCalloutId === regionId) setActiveCalloutId(updatedRegions[0]?.id);
  };
  const updateSummaryItem = (item: DraftMeal['items'][number]) => {
    const region = regions.find((candidateRegion) => candidateRegion.id === item.id);
    if (!region) return;
    const current =
      region.candidates.find((candidate) => candidate.id === region.selectedCandidateId) ??
      region.candidates[0];
    if (!current) return;
    const updatedCandidate = {
      ...current,
      displayName: item.name,
      estimatedGrams: Math.max(0, item.amount),
    };
    const updatedRegions = regions.map((candidateRegion) =>
      candidateRegion.id !== region.id
        ? candidateRegion
        : {
            ...candidateRegion,
            status: 'recognized' as const,
            selectedCandidateId: updatedCandidate.id,
            candidates: candidateRegion.candidates.some(
              (candidate) => candidate.id === updatedCandidate.id,
            )
              ? candidateRegion.candidates.map((candidate) =>
                  candidate.id === updatedCandidate.id ? updatedCandidate : candidate,
                )
              : [...candidateRegion.candidates, updatedCandidate],
          },
    );
    setMeal({ ...meal, foodRegions: updatedRegions, items: regionsToMealItems(updatedRegions) });
  };
  const selectEditorCandidate = (candidate: FoodCandidate) => {
    setEditingCandidateId(candidate.id);
    setEditingName(localizeFoodName(candidate.displayName));
    setEditingGrams(String(candidate.estimatedGrams));
  };
  const spread = 1.08 + (1 - confidence) * 0.18;
  const rangeMin = Math.max(0, Math.round(totals.calories / spread));
  const rangeMax = Math.round(totals.calories * spread);
  const unresolvedRegions = regions.filter(
    (region) =>
      region.status === 'unknown' || (region.status === 'ambiguous' && !region.selectedCandidateId),
  );
  const coverageUnresolved = meal.coverageComplete === false || unresolvedRegions.length > 0;
  const handleSave = async () => {
    if (coverageUnresolved) {
      Alert.alert(
        'Bazı yiyecekleri tanımlayamadık',
        'Turuncu bölge noktalarına dokunup bir seçenek seç veya bölgeyi silmeden öğünü kaydedemezsin.',
      );
      return;
    }
    setSaving(true);
    const finalRegions = cloneRegions(regions);
    const records = buildCorrections(meal.initialFoodRegions ?? [], finalRegions, meal.mealType);
    await saveMeal({ ...meal, items: regionsToMealItems(finalRegions), foodRegions: finalRegions });
    await addCorrections(records);
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingHorizontal: 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity accessibilityLabel="Geri dön" onPress={() => router.back()}>
          <Text style={{ color: colors.ink, fontSize: 28 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.eyebrow, { marginBottom: 0 }]}>GÖRSEL ÖĞÜN İNCELEMESİ</Text>
        <TouchableOpacity onPress={() => router.replace('/scan')}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }}>Tekrar çek</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { marginTop: 18 }]}>Öğünü gözden geçir</Text>
      <Text style={[styles.subtitle, { marginTop: 8 }]}>
        {regions.length} görsel bölge bulduk. Her bölge tek bir malzeme olarak düzenlenir.
      </Text>
      <View
        onLayout={(event) =>
          setPhotoSize({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
        style={{
          height: Math.min(window.width * 0.92, 390),
          marginTop: 20,
          borderRadius: 26,
          overflow: 'hidden',
          backgroundColor: colors.ink,
          position: 'relative',
        }}
      >
        {params.imageUri ? (
          <Image
            source={{ uri: params.imageUri }}
            resizeMode="contain"
            onLoad={(event) => {
              const source = event.nativeEvent.source;
              if (source?.width && source?.height) setImageAspect(source.width / source.height);
            }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.white }}>Fotoğraf bulunamadı</Text>
          </View>
        )}
        {regions.map((region) => (
          <TouchableOpacity
            key={`region-hit-${region.id}`}
            accessibilityRole="button"
            accessibilityLabel="Bu görsel bölgeyi seç"
            onPress={() => {
              setActiveCalloutId(region.id);
              setHighlightedRegionId(region.id);
            }}
            style={{
              position: 'absolute',
              left: imageRect.x + region.boundingBox.x * imageRect.width,
              top: imageRect.y + region.boundingBox.y * imageRect.height,
              width: region.boundingBox.width * imageRect.width,
              height: region.boundingBox.height * imageRect.height,
            }}
          />
        ))}
        {regions.map((region) =>
          highlightedRegionId === region.id ? (
            <View
              key={`highlight-${region.id}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: imageRect.x + region.boundingBox.x * imageRect.width,
                top: imageRect.y + region.boundingBox.y * imageRect.height,
                width: region.boundingBox.width * imageRect.width,
                height: region.boundingBox.height * imageRect.height,
                borderWidth: 3,
                borderColor: region.status === 'recognized' ? colors.mint : colors.orange,
                backgroundColor: region.status === 'recognized' ? '#DDEFE522' : '#E4935822',
                borderRadius: 12,
              }}
            />
          ) : null,
        )}
        {callouts.map((callout) => {
          const region = regions.find((item) => item.id === callout.id);
          if (!region) return null;
          const candidate =
            region.candidates.find((item) => item.id === region.selectedCandidateId) ??
            region.candidates[0];
          const unknown = region.status === 'unknown' || !candidate;
          const ambiguous = region.status === 'ambiguous' || !region.selectedCandidateId;
          const title = unknown
            ? 'Bu nedir?'
            : ambiguous
              ? `${candidate.displayName} olabilir`
              : candidate.displayName;
          const subtitle = unknown
            ? 'Tanımlamak için dokun'
            : ambiguous
              ? `${candidate.estimatedGrams} g · Kontrol et`
              : `${candidate.estimatedGrams} g · ${candidateNutrition(candidate).calories} kcal`;
          const color = unknown || ambiguous ? colors.orange : colors.mint;
          const cardX = callout.cardX;
          const cardY = callout.cardY;
          const centerX = cardX + callout.cardWidth / 2;
          const centerY = cardY + 31;
          const lineWidth = Math.max(
            2,
            Math.hypot(callout.anchorX - centerX, callout.anchorY - centerY),
          );
          const angle =
            (Math.atan2(callout.anchorY - centerY, callout.anchorX - centerX) * 180) / Math.PI;
          return (
            <View key={region.id}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: Math.min(callout.anchorX, centerX),
                  top: Math.min(callout.anchorY, centerY),
                  width: lineWidth,
                  height: 1.5,
                  backgroundColor: color,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: callout.anchorX - 5,
                  top: callout.anchorY - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: color,
                  borderWidth: 2,
                  borderColor: colors.ink,
                }}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${subtitle}. Ürünü düzenlemek için tekrar dokun.`}
                onPress={() => {
                  setHighlightedRegionId(region.id);
                  openEditor(region);
                }}
                style={{
                  position: 'absolute',
                  left: cardX,
                  top: cardY,
                  width: callout.cardWidth,
                  minHeight: 62,
                  backgroundColor: unknown || ambiguous ? '#FFF0E2' : colors.white,
                  borderRadius: 14,
                  padding: 9,
                  borderWidth: 1.5,
                  borderColor: color,
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: colors.ink, fontWeight: '800', fontSize: 12 }}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    color: unknown || ambiguous ? '#9A5D2E' : colors.muted,
                    fontSize: 10,
                    marginTop: 4,
                  }}
                >
                  {subtitle}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {regions.map((region) => (
          <TouchableOpacity
            key={`anchor-${region.id}`}
            accessibilityRole="button"
            accessibilityLabel="Bu bölgenin ürün adını göster"
            onPress={() => {
              setActiveCalloutId(region.id);
              setHighlightedRegionId(region.id);
            }}
            style={{
              position: 'absolute',
              left: imageRect.x + region.anchor.x * imageRect.width - 17,
              top: imageRect.y + region.anchor.y * imageRect.height - 17,
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 13,
                height: 13,
                borderRadius: 7,
                backgroundColor: region.status === 'recognized' ? colors.mint : colors.orange,
                borderWidth: 2,
                borderColor: colors.ink,
              }}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        {regions.length > 1
          ? 'Bölge noktalarına dokunarak malzemeyi incele'
          : 'Düzenlemek için fotoğraftaki etikete dokun'}
      </Text>
      <View style={{ marginTop: 18 }}>
        <SectionLabel>GÖRSEL MALZEMELER</SectionLabel>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
          İsim ve gramajı buradan da düzenleyebilirsin.
        </Text>
        {regions.map((region) => {
          const item = regionsToMealItems([region])[0];
          if (!item)
            return (
              <TouchableOpacity
                key={region.id}
                onPress={() => openEditor(region)}
                style={{
                  padding: 15,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.orange,
                  backgroundColor: colors.softOrange,
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: '#9A5D2E', fontWeight: '800' }}>Bu nedir?</Text>
                <Text style={{ color: '#9A5D2E', fontSize: 12, marginTop: 4 }}>
                  Bölgeyi tanımlamak için dokun
                </Text>
              </TouchableOpacity>
            );
          return (
            <FoodItemRow
              key={region.id}
              item={item}
              onChange={updateSummaryItem}
              onDelete={() => removeRegionById(region.id)}
            />
          );
        })}
      </View>
      {meal.uncertaintyQuestions
        ?.filter((question) => !answeredQuestionIds.includes(question.id))
        .map((question) => (
          <View
            key={question.id}
            style={{
              marginTop: 18,
              borderRadius: 16,
              padding: 14,
              backgroundColor: '#FFF7EE',
              borderWidth: 1,
              borderColor: '#F0B47B',
            }}
          >
            <Text style={{ color: '#9A5D2E', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }}>
              SADECE GEREKLİ BELİRSİZLİK
            </Text>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 6 }}>
              {question.prompt}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
              {question.reason}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {question.options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => answerQuestion(question, option)}
                  style={{
                    backgroundColor: colors.white,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 12 }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      <View style={[styles.card, { marginTop: 22, backgroundColor: colors.ink }]}>
        <Text style={{ color: '#B9D2C2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
          {coverageUnresolved ? 'GEÇİCİ TAHMİN · KAPSAM EKSİK' : 'TAHMİNİ TOPLAM'}
        </Text>
        <Text style={{ color: colors.white, fontSize: 32, fontWeight: '800', marginTop: 6 }}>
          {rangeMin}–{rangeMax} <Text style={{ fontSize: 15, fontWeight: '600' }}>kcal</Text>
        </Text>
        <Text style={{ color: '#B9D2C2', fontSize: 13, marginTop: 4 }}>
          {totals.protein.toFixed(1)}g protein · {totals.carbs.toFixed(1)}g karbonhidrat ·{' '}
          {totals.fat.toFixed(1)}g yağ
        </Text>
      </View>
      {coverageUnresolved ? (
        <View
          style={{
            marginTop: 14,
            borderRadius: 14,
            padding: 13,
            backgroundColor: colors.softOrange,
            borderWidth: 1,
            borderColor: colors.orange,
          }}
        >
          <Text style={{ color: '#8C5229', fontWeight: '800' }}>
            Bazı yiyecekleri tanımlayamadık
          </Text>
          <Text style={{ color: '#8C5229', fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            Turuncu bölge noktalarına dokunup bir seçenek seç veya bölgeyi sil.
          </Text>
        </View>
      ) : null}
      {meal.hiddenIngredientSuggestions?.length ? (
        <View
          style={{
            marginTop: 18,
            backgroundColor: '#FFF7EE',
            borderWidth: 1,
            borderColor: '#F0B47B',
            borderRadius: 14,
            padding: 13,
          }}
        >
          <Text style={{ color: '#9A5D2E', fontSize: 11, fontWeight: '800' }}>
            GİZLİ OLABİLECEK İÇERİKLER
          </Text>
          {meal.hiddenIngredientSuggestions.map((suggestion) => (
            <Text key={suggestion.id} style={{ color: colors.ink, marginTop: 6 }}>
              {suggestion.displayName} · {suggestion.reason}
            </Text>
          ))}
        </View>
      ) : null}
      <PrimaryButton onPress={handleSave} style={{ marginTop: 24 }}>
        {saving ? 'Kaydediliyor…' : 'Öğünü kaydet ✓'}
      </PrimaryButton>
      {__DEV__ && diagnostics.length ? (
        <View style={{ marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: '#EAF0ED' }}>
          <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '800' }}>
            DEV · CORRECTION MEMORY
          </Text>
          {diagnostics.map((diagnostic) => (
            <View key={diagnostic.regionId} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 11 }}>
                Orijinal:{' '}
                {diagnostic.originalRanking
                  .map(
                    (item) => `${item.canonicalName} ${Math.round(item.visualConfidence * 100)}%`,
                  )
                  .join(' · ')}
              </Text>
              <Text style={{ color: colors.ink, fontSize: 11 }}>
                Final:{' '}
                {diagnostic.finalRanking
                  .map(
                    (item) =>
                      `${item.canonicalName} ${item.finalScore.toFixed(2)} (+${item.memoryBoost.toFixed(2)})`,
                  )
                  .join(' · ')}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Kayıt: {diagnostic.appliedRecords.length} · Sıra değişti:{' '}
                {diagnostic.changed ? 'evet' : 'hayır'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Modal
        visible={Boolean(editingRegion)}
        transparent
        animationType="slide"
        onRequestClose={closeDrawer}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
          <Animated.View
            {...drawerPanResponder.panHandlers}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              padding: 22,
              paddingBottom: 34,
              maxHeight: '88%',
              transform: [{ translateY: drawerTranslateY }],
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
              <View
                style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line }}
              />
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 5 }}>
                Kapatmak için aşağı kaydır
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.eyebrow}>MALZEMEYİ DÜZENLE</Text>
                <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '800', marginTop: 5 }}>
                  Bu ürün nedir?
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Düzenleme penceresini kapat"
                onPress={closeDrawer}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 20 }}>×</Text>
              </TouchableOpacity>
            </View>
            {editingRegion?.memoryRecommendation && (
              <Text style={{ color: '#9A5D2E', fontSize: 12, fontWeight: '800', marginTop: 10 }}>
                Önceki düzeltmene göre önerildi
              </Text>
            )}
            {editingRegion?.candidates.map((candidate) => (
              <TouchableOpacity
                key={candidate.id}
                onPress={() => selectEditorCandidate(candidate)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  marginTop: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: editingCandidateId === candidate.id ? colors.ink : colors.line,
                  backgroundColor: editingCandidateId === candidate.id ? colors.mint : colors.white,
                }}
              >
                <View>
                  <Text style={{ color: colors.ink, fontWeight: '800' }}>
                    {candidate.displayName}
                  </Text>
                  {editingRegion.memoryRecommendation?.candidateId === candidate.id && (
                    <Text style={{ color: '#9A5D2E', fontSize: 10, marginTop: 3 }}>
                      Önceki düzeltmene göre
                    </Text>
                  )}
                </View>
                <Text style={{ color: colors.muted, fontWeight: '700' }}>
                  %{Math.round(candidate.confidence * 100)}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Başka malzeme seç"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.white,
                borderRadius: 14,
                padding: 14,
                color: colors.ink,
                fontSize: 16,
                marginTop: 12,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 14,
              }}
            >
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Gramaj</Text>
              <TextInput
                value={editingGrams}
                onChangeText={setEditingGrams}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 12,
                  padding: 10,
                  minWidth: 90,
                  textAlign: 'center',
                  color: colors.ink,
                  fontWeight: '800',
                }}
              />
              <Text style={{ color: colors.muted }}>g</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={removeRegion}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.softOrange,
                }}
              >
                <Text style={{ color: '#9A5D2E', fontWeight: '800' }}>Bölgeyi sil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyRegionEdit}
                style={{
                  flex: 2,
                  minHeight: 52,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.ink,
                }}
              >
                <Text style={{ color: colors.white, fontWeight: '800' }}>Seçimi onayla</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
}
// Visual meal review screen: renders AI regions as callouts and manages corrections and saving.
