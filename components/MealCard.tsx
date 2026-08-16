import { Text, TouchableOpacity, View } from 'react-native';
import { Meal } from '@/types/meal';
import { colors, styles } from './ui';
import { localizeFoodName } from '@/utils/localization';
export function MealCard({ meal }: { meal: Meal }) {
  const calories = meal.items.reduce((sum, item) => sum + item.calories, 0);
  const mealTypeLabel = {
    breakfast: 'Kahvaltı',
    lunch: 'Öğle',
    dinner: 'Akşam',
    snack: 'Ara öğün',
  }[meal.mealType];
  return (
    <View style={[styles.card, { marginTop: 10, borderWidth: 1, borderColor: colors.line }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: colors.softOrange,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 20 }}>🥗</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}
            >
              {localizeFoodName(meal.name)}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>
              {meal.items.length} malzeme · {mealTypeLabel}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: colors.ink, fontSize: 15, fontWeight: '800', marginLeft: 10 }}
        >
          {calories} kcal
        </Text>
      </View>
    </View>
  );
}
// Card component that summarizes one saved meal on the Today screen.
