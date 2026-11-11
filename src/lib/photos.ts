// Telefon ilovasi: galereyadan tanlash yoki kamerada olish, so'ng kichraytirib siqish
// (eski andoza.js bilan bir xil: eng katta tomoni 1000 px, JPEG sifati 0.72).
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_SIDE = 1000;
const QUALITY = 0.72;

export async function pickPhotos(source: 'library' | 'camera'): Promise<string[]> {
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Kameraga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering.');
    res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, selectionLimit: 10 });
  }
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets) {
    try {
      const big = Math.max(a.width, a.height);
      const resize = big > MAX_SIDE ? [{ resize: a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
      const r = await manipulateAsync(a.uri, resize, { compress: QUALITY, format: SaveFormat.JPEG, base64: true });
      if (r.base64) out.push(`data:image/jpeg;base64,${r.base64}`);
    } catch { /* bitta rasm o'tmasa, qolganlari davom etadi */ }
  }
  return out;
}
