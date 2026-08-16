import { useMemo, useState } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { PrimaryButton, SectionLabel, colors, styles } from '@/components/ui';
import { useMealStore } from '@/store/meal-store';
import { inferMealContext, MealType } from '@/services/meal-context';

export default function AddMealScreen() {
  const [imageUri, setImageUri] = useState<string>();
  const [description, setDescription] = useState('');
  const meals = useMealStore((state) => state.meals);
  const setPendingImage = useMealStore((state) => state.setPendingImage);
  const context = useMemo(() => inferMealContext(new Date(), meals), [meals]);
  const [mealType, setMealType] = useState<MealType>(context.mealType);
  const mealTypes: Array<{ value: MealType; label: string }> = [
    { value: 'breakfast', label: 'Kahvaltı' },
    { value: 'lunch', label: 'Öğle' },
    { value: 'dinner', label: 'Akşam' },
    { value: 'snack', label: 'Ara öğün' },
  ];
  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setPendingImage(asset.base64 ?? undefined, asset.mimeType ?? 'image/jpeg');
    }
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity accessibilityLabel="Geri dön" onPress={() => router.back()}>
        <Text style={{ color: colors.ink, fontSize: 28 }}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { marginTop: 18 }]}>Öğün ekle</Text>
      <Text style={[styles.subtitle, { marginTop: 8 }]}>
        Fotoğraf, daha doğru bir tahmin yapmamıza yardımcı olur.
      </Text>
      <View style={{ marginTop: 20 }}>
        <SectionLabel>ÖĞÜN TÜRÜ</SectionLabel>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{context.reason}</Text>
        {context.isFirstMeal ? (
          <View
            style={{ marginTop: 10, backgroundColor: colors.mint, borderRadius: 12, padding: 10 }}
          >
            <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>
              Bugünün ilk öğünü olabilir
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
              Geç uyanıldıysa saatten bağımsız olarak kahvaltı veya geç kahvaltı kabul edilebilir.
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {mealTypes.map((item) => (
            <TouchableOpacity
              key={item.value}
              onPress={() => setMealType(item.value)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 13,
                borderRadius: 14,
                backgroundColor: mealType === item.value ? colors.ink : colors.white,
                borderWidth: 1,
                borderColor: mealType === item.value ? colors.ink : colors.line,
              }}
            >
              <Text
                style={{
                  color: mealType === item.value ? colors.white : colors.ink,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/scan', params: { mealType } })}
        style={{
          marginTop: 18,
          backgroundColor: colors.ink,
          borderRadius: 15,
          padding: 15,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '800' }}>✦ Kamerayla öğün tara</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={choosePhoto}
        activeOpacity={0.85}
        style={{
          height: 230,
          borderRadius: 24,
          backgroundColor: imageUri ? colors.ink : colors.mint,
          marginTop: 28,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <>
            <Text style={{ fontSize: 34 }}>📷</Text>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 10 }}>
              Öğün fotoğrafı seç
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 5 }}>
              Galerinden bir fotoğraf seç
            </Text>
          </>
        )}
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
          VEYA YAZARAK ANLAT
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>
      <SectionLabel>ÖĞÜN AÇIKLAMASI</SectionLabel>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="ör. bir yumurtalı avokadolu tost"
        placeholderTextColor="#A7B1AB"
        style={{
          minHeight: 88,
          backgroundColor: colors.white,
          borderRadius: 16,
          padding: 16,
          color: colors.ink,
          fontSize: 15,
          textAlignVertical: 'top',
          borderWidth: 1,
          borderColor: colors.line,
        }}
      />
      <PrimaryButton
        onPress={() =>
          router.push({ pathname: '/analyze', params: { imageUri, description, mealType } })
        }
        style={{ marginTop: 24 }}
      >
        Öğünü analiz et →
      </PrimaryButton>
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          lineHeight: 18,
          textAlign: 'center',
          marginTop: 12,
        }}
      >
        Kaydetmeden önce tahmini inceleyip düzeltebilirsin.
      </Text>
    </ScrollView>
  );
}
// New meal entry screen: collects the meal type, photo, or text description and starts analysis.
