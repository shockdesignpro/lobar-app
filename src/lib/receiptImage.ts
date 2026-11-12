// Telefon ilovasi: chek JPG rasm qilinadi (brauzerdagi bilan bir xil dizayn, 3x aniqlik).
// "Yuklab olish" — rasm galereyaga saqlanadi; "Ulashish" — tizimning ulashish oynasi (Telegram va h.k.).
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { renderReceiptJpeg } from '../ui/ReceiptRenderer';

export type ReceiptImage = { uri: string; fileName: string; width: number; height: number };

export const isIOS = () => Platform.OS === 'ios';

export async function makeReceiptImage(innerHtml: string, fileName: string): Promise<ReceiptImage> {
  const { base64, width, height } = await renderReceiptJpeg(innerHtml);
  const safe = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  file.create();
  await file.write(base64, { encoding: 'base64' });
  return { uri: file.uri, fileName: safe, width, height };
}

/** Galereyaga saqlash. true — saqlandi */
export async function downloadReceipt(img: ReceiptImage): Promise<boolean> {
  try {
    const p = await MediaLibrary.requestPermissionsAsync(true);
    if (!p.granted) return false;
    await MediaLibrary.saveToLibraryAsync(img.uri);
    return true;
  } catch {
    return false;
  }
}

export async function shareReceipt(img: ReceiptImage): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(img.uri, { mimeType: 'image/jpeg', dialogTitle: img.fileName, UTI: 'public.jpeg' });
  return true;
}

/** Saqlangandan keyin chek rasmi o'zi galereyaga tushadi (eski ilovadagidek "yuklab olinadi") */
export const autoDownloadAfterSave = () => true;
