import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '@/components/ui';
import { useMealStore } from '@/store/meal-store';

type ScanState = 'requesting_permission' | 'ready' | 'capturing' | 'final_analysis' | 'error';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const captureLockRef = useRef(false);
  const hasCapturedRef = useRef(false);
  const mountedRef = useRef(true);
  const [scanState, setScanState] = useState<ScanState>('requesting_permission');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const setPendingImage = useMealStore((state) => state.setPendingImage);
  const params = useLocalSearchParams<{ mealType?: string }>();

  useEffect(() => {
    if (permission?.granted) setScanState('ready');
    else if (permission?.canAskAgain) void requestPermission();
    else setScanState('error');
  }, [permission, requestPermission]);
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      captureLockRef.current = false;
      hasCapturedRef.current = false;
      return () => {
        mountedRef.current = false;
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        mountedRef.current = false;
        captureLockRef.current = true;
      }
    });
    return () => subscription.remove();
  }, []);

  // Ref guards catch rapid double taps before the React state update is committed.
  const captureFinal = useCallback(async () => {
    if (
      captureLockRef.current ||
      hasCapturedRef.current ||
      !mountedRef.current ||
      !cameraRef.current ||
      scanState === 'capturing' ||
      scanState === 'final_analysis'
    )
      return;
    captureLockRef.current = true;
    hasCapturedRef.current = true;
    setScanState('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: true,
        skipProcessing: false,
      });
      if (!photo?.base64 || !mountedRef.current) throw new Error('Fotoğraf alınamadı');
      setPendingImage(photo.base64, 'image/jpeg');
      setScanState('final_analysis');
      router.replace({
        pathname: '/analyze',
        params: { imageUri: photo.uri, mealType: params.mealType },
      });
    } catch (error) {
      if (mountedRef.current) {
        console.error('Meal capture failed', error);
        captureLockRef.current = false;
        hasCapturedRef.current = false;
        setScanState('error');
      }
    }
  }, [scanState, setPendingImage]);
  if (!permission?.granted)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <Text style={{ color: colors.white, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
          Kameraya erişim gerekli
        </Text>
        <Text style={{ color: '#B9D2C2', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
          {permission?.canAskAgain
            ? 'Yemeği canlı analiz etmek için kamera izni ver.'
            : 'Ayarlar’dan kamera iznini açıp tekrar dene.'}
        </Text>
        {permission?.canAskAgain && (
          <TouchableOpacity
            onPress={() => void requestPermission()}
            style={{
              marginTop: 24,
              backgroundColor: colors.white,
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: colors.ink, fontWeight: '800' }}>Kamera izni ver</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18 }}>
          <Text style={{ color: '#B9D2C2', fontWeight: '700' }}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );

  const busy = scanState === 'capturing' || scanState === 'final_analysis';
  return (
    <View style={{ flex: 1, backgroundColor: '#091C18' }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        flash={flash}
        mode="picture"
        onCameraReady={() => !busy && setScanState('ready')}
      />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          inset: 0,
          paddingTop: 56,
          paddingHorizontal: 18,
          paddingBottom: 35,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <TouchableOpacity
            accessibilityLabel="Kameradan çık"
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#0008',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.white, fontSize: 28 }}>‹</Text>
          </TouchableOpacity>
          <View
            style={{
              backgroundColor: '#0009',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 12, fontWeight: '800' }}>
              YÖNLENDİRİLMİŞ ÖĞÜN TARAMASI
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Flaşı değiştir"
            disabled={busy}
            onPress={() => setFlash((value) => (value === 'off' ? 'on' : 'off'))}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#0008',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 19 }}>{flash === 'on' ? '⚡' : '◌'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center' }}>
          <View
            pointerEvents="none"
            style={{
              width: '88%',
              height: 260,
              borderWidth: 2,
              borderColor: '#FFFFFFAA',
              borderRadius: 28,
            }}
          />
          <View
            style={{
              backgroundColor: '#000B',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginTop: 18,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>
              Tabağın tamamını kadraja al
            </Text>
          </View>
        </View>
        <View>
          <Text
            style={{
              color: colors.white,
              textAlign: 'center',
              fontWeight: '700',
              marginBottom: 16,
            }}
          >
            {busy ? 'Fotoğraf analiz ediliyor…' : 'Hazır olduğunda tek kez çek'}
          </Text>
          <TouchableOpacity
            accessibilityLabel="Öğün fotoğrafını çek"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void captureFinal()}
            style={{
              alignSelf: 'center',
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: colors.white,
              borderWidth: 6,
              borderColor: '#FFFFFF88',
              opacity: busy ? 0.45 : 1,
            }}
          />
        </View>
      </View>
    </View>
  );
}
// Camera screen: does not perform real-time detection; it captures one user-requested photo and sends it for AI analysis.
