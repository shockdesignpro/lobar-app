// Profil rasmi uchun kamera: o'rtada tushirish tugmasi, o'ngda old/orqa kamera,
// chap pastda galereyadagi oxirgi rasm — bosilsa (ruxsat so'rab) galereyadan tanlanadi.
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { pickAvatar, squareAvatar } from '../lib/photos';
import { Icon } from './Icon';

export function AvatarCamera({ onClose, onPicked, onError }: {
  onClose: () => void; onPicked: (dataUrl: string) => void; onError: (m: string) => void;
}) {
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) void requestPerm(); }, [perm, requestPerm]);

  // Galereyaga ruxsat oldin berilgan bo'lsa — oxirgi rasmni ko'rsatamiz
  const loadThumb = async () => {
    try {
      const page = await MediaLibrary.getAssetsAsync({ first: 1, mediaType: 'photo', sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
      setThumb(page.assets[0]?.uri ?? null);
    } catch { /* ruxsat yo'q */ }
  };
  useEffect(() => {
    MediaLibrary.getPermissionsAsync(false, ['photo']).then((p) => { if (p.granted) void loadThumb(); }).catch(() => {});
  }, []);

  const shoot = async () => {
    if (!cam.current || !ready || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.9 });
      const data = await squareAvatar(pic.uri, pic.width, pic.height);
      if (data) onPicked(data);
    } catch (e) { onError(e instanceof Error ? e.message : 'Rasmga olib bo‘lmadi'); }
    setBusy(false);
  };

  const gallery = async () => {
    if (busy) return;
    try {
      const p = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!p.granted) { onError('Galereyaga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering.'); return; }
      void loadThumb();
      setBusy(true);
      const data = await pickAvatar('library');
      setBusy(false);
      if (data) onPicked(data);
    } catch (e) { setBusy(false); onError(e instanceof Error ? e.message : 'Galereya ochilmadi'); }
  };

  const denied = perm && !perm.granted && !perm.canAskAgain;
  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {perm?.granted ? (
              <CameraView ref={cam} style={{ flex: 1 }} facing={facing} mirror={facing === 'front'} onCameraReady={() => setReady(true)} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
                <Icon name="camera" color="#ffffff" size={40} />
                <Text style={{ color: '#ffffff', fontSize: 15, textAlign: 'center' }}>
                  {denied ? 'Kameraga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering yoki galereyadan tanlang.' : 'Kameraga ruxsat so‘ralmoqda…'}
                </Text>
              </View>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose}
              style={{ position: 'absolute', top: 12, left: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" color="#ffffff" size={20} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 22 }}>
            {/* Chap: galereya */}
            <Pressable accessibilityRole="button" accessibilityLabel="Galereyadan tanlash" onPress={gallery}
              style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222222' }}>
              {thumb ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} /> : <Icon name="image" color="#ffffff" size={22} />}
            </Pressable>
            {/* O'rta: rasmga olish */}
            <Pressable accessibilityRole="button" accessibilityLabel="Rasmga olish" onPress={shoot} disabled={!perm?.granted}
              style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', opacity: perm?.granted ? (pressed ? 0.7 : 1) : 0.4 })}>
              {busy ? <ActivityIndicator color="#ffffff" /> : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff' }} />}
            </Pressable>
            {/* O'ng: old/orqa kamera */}
            <Pressable accessibilityRole="button" accessibilityLabel="Kamerani almashtirish" onPress={() => { setReady(false); setFacing((f) => (f === 'front' ? 'back' : 'front')); }}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flip" color="#ffffff" size={22} />
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
