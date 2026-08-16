import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MealItem } from '@/types/meal';
import { colors } from './ui';

function scaleItem(item: MealItem, amount: number): MealItem {
  const ratio = item.amount > 0 ? amount / item.amount : 1;
  return {
    ...item,
    amount,
    calories: Math.round(item.calories * ratio),
    protein: Number((item.protein * ratio).toFixed(1)),
    carbs: Number((item.carbs * ratio).toFixed(1)),
    fat: Number((item.fat * ratio).toFixed(1)),
    correctedByUser: true,
  };
}

export function FoodItemRow({
  item,
  onChange,
  onDelete,
}: {
  item: MealItem;
  onChange: (item: MealItem) => void;
  onDelete: () => void;
}) {
  const lowConfidence = item.confidence < 0.75;
  const step = item.unit === 'piece' ? 1 : 10;
  return (
    <View
      style={{
        paddingVertical: 15,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: lowConfidence ? '#F0B47B' : colors.line,
        backgroundColor: lowConfidence ? '#FFF7EE' : 'transparent',
        borderRadius: 12,
        marginBottom: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <TextInput
            value={item.name}
            onChangeText={(name) => onChange({ ...item, name, correctedByUser: true })}
            style={{
              color: colors.ink,
              fontSize: 16,
              fontWeight: '800',
              padding: 0,
              flexShrink: 1,
            }}
          />
          <Text style={{ color: colors.muted, fontSize: 15 }}>✎</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Delete ingredient"
          onPress={onDelete}
          style={{ padding: 5 }}
        >
          <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 9,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
          {item.calories} kcal · {item.protein}g protein · {Math.round(item.confidence * 100)}%
          güven
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            accessibilityLabel="Decrease portion"
            onPress={() =>
              onChange(scaleItem(item, Math.max(item.unit === 'piece' ? 1 : 5, item.amount - step)))
            }
            style={{
              width: 27,
              height: 27,
              borderRadius: 9,
              backgroundColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 18 }}>−</Text>
          </TouchableOpacity>
          <TextInput
            value={String(item.amount)}
            keyboardType="numeric"
            onChangeText={(amount) => onChange(scaleItem(item, Math.max(0, Number(amount) || 0)))}
            style={{
              color: colors.ink,
              width: 40,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: '800',
              padding: 0,
            }}
          />
          <TouchableOpacity
            accessibilityLabel="Increase portion"
            onPress={() => onChange(scaleItem(item, item.amount + step))}
            style={{
              width: 27,
              height: 27,
              borderRadius: 9,
              backgroundColor: colors.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 18 }}>＋</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.muted, width: 28, fontSize: 13 }}>{item.unit}</Text>
        </View>
      </View>
      {lowConfidence && (
        <TouchableOpacity
          onPress={() => onChange({ ...item, confidence: 0.9, correctedByUser: true })}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#F6D5B4',
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 8,
            marginTop: 9,
          }}
        >
          <Text style={{ color: '#9A5D2E', fontSize: 11, fontWeight: '800' }}>
            DÜŞÜK GÜVEN · ONAYLA
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
// Editable ingredient row below the image; supports name changes, portion adjustments, and removal.
