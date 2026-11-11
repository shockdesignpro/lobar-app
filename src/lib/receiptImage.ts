// Telefon ilovasi: chek PDF fayl qilinadi va tizimning ulashish oynasi ochiladi
// (Telegram, galereya, fayllar va h.k.). Dizayn brauzerdagi chek bilan bir xil.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { receiptDocument } from './receipt';

export type ReceiptImage = { uri: string; fileName: string; width: number; height: number };

export const isIOS = () => false;

export async function makeReceiptImage(innerHtml: string, fileName: string): Promise<ReceiptImage> {
  const { uri } = await Print.printToFileAsync({ html: receiptDocument(innerHtml), width: 440 });
  return { uri, fileName: fileName.replace(/\.jpg$/, '.pdf'), width: 0, height: 0 };
}

export function downloadReceipt(img: ReceiptImage) {
  return shareReceipt(img);
}

export async function shareReceipt(img: ReceiptImage): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(img.uri, { mimeType: 'application/pdf', dialogTitle: img.fileName, UTI: 'com.adobe.pdf' });
  return true;
}

export const autoDownloadAfterSave = () => false;
