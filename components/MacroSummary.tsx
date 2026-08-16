import { Text, View } from 'react-native';
import { colors, styles } from './ui';
export function MacroSummary({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  const formatMacro = (value: number) => Number(value.toFixed(1));
  return (
    <View style={[styles.card, { backgroundColor: colors.mint, marginTop: 22 }]}>
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
      >
        <View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
            BUGÜNÜN ENERJİSİ
          </Text>
          <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
            {calories}
            <Text style={{ fontSize: 15 }}> kcal</Text>
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>2.100 kcal hedef</Text>
      </View>
      <View
        style={{
          height: 8,
          backgroundColor: '#C4DDCE',
          borderRadius: 5,
          marginTop: 16,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.min(100, calories / 21)}%`,
            height: '100%',
            backgroundColor: colors.ink,
            borderRadius: 5,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 18, gap: 10 }}>
        {[
          ['Protein', protein, '#5C8E6B'],
          ['Karbonhidrat', carbs, '#E49358'],
          ['Yağ', fat, '#C96A51'],
        ].map(([label, value, color]) => (
          <View key={String(label)} style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
              {label}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4 }}
            >
              {formatMacro(Number(value))}g{' '}
              <Text style={{ color: String(color), fontSize: 12 }}>●</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
// Displays today's calorie and macro totals in a readable card without layout overflow.
