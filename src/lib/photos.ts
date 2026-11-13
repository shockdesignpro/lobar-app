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

/** Rasmni o'rtasidan kvadrat qilib qirqib, 400×400 JPEG qiladi */
export async function squareAvatar(uri: string, width: number, height: number): Promise<string | null> {
  const side = Math.min(width, height);
  const r = await manipulateAsync(uri, [
    { crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side } },
    { resize: { width: 400, height: 400 } },
  ], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  return r.base64 ? `data:image/jpeg;base64,${r.base64}` : null;
}

/** Profil rasmi: kamera yoki galereya (telefon o'zi qirqish oynasini ko'rsatadi), 400×400 */
export async function pickAvatar(source: 'library' | 'camera'): Promise<string | null> {
  let res: ImagePicker.ImagePickerResult;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Kameraga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering.');
    res = await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front });
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return squareAvatar(a.uri, a.width, a.height);
}
