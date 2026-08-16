import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MealCard } from '@/components/MealCard';
import { MacroSummary } from '@/components/MacroSummary';
import { PrimaryButton, SectionLabel, colors, styles } from '@/components/ui';
import { useMealStore } from '@/store/meal-store';
import { getTodayMeals } from '@/services/meal-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TodayScreen() {
  const { meals: allMeals, hydrate, hydrated } = useMealStore();
  const meals = useMemo(() => getTodayMeals(allMeals), [allMeals]);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);
  const totals = useMemo(
    () =>
      meals.reduce(
        (acc, meal) =>
          meal.items.reduce(
            (inner, item) => ({
              calories: inner.calories + item.calories,
              protein: inner.protein + item.protein,
              carbs: inner.carbs + item.carbs,
              fat: inner.fat + item.fat,
            }),
            acc,
          ),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [meals],
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(20, insets.top + 12) }]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View>
          <Text style={styles.eyebrow}>BUGÜN</Text>
          <Text style={[styles.title, { marginTop: 8 }]}>Günaydın, Salih</Text>
          <Text style={[styles.subtitle, { marginTop: 8 }]}>Küçük seçimler, daha iyi enerji.</Text>
        </View>
        <View
          style={{
            width: 42,
            height: 42,
            backgroundColor: colors.ink,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>S</Text>
        </View>
      </View>
      <MacroSummary {...totals} />
      <View
        style={{
          marginTop: 30,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <SectionLabel style={{ marginBottom: 0 }}>BUGÜN EKLENEN ÖĞÜNLER</SectionLabel>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{meals.length}/4 öğün</Text>
      </View>
      {meals.length ? (
        meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
      ) : (
        <View
          style={[
            styles.card,
            {
              marginTop: 10,
              alignItems: 'center',
              paddingVertical: 28,
              borderWidth: 1,
              borderColor: colors.line,
            },
          ]}
        >
          <Text style={{ fontSize: 28 }}>🍽️</Text>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 10 }}>
            Henüz öğün eklenmedi
          </Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 5 }]}>
            İlk öğününü ekle, kalanını birlikte tahmin edelim.
          </Text>
        </View>
      )}
      <PrimaryButton onPress={() => router.push('/add')} style={{ marginTop: 22 }}>
        ＋ Öğün ekle
      </PrimaryButton>
    </ScrollView>
  );
}
// Today screen: displays today's meals stored on the device and their total nutrition values.
