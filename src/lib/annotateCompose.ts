// Telefon ilovasi: chizilgan rasmni ko'rinmas WebView'dagi canvas'da birlashtiramiz
import { annotatePage, type Stroke } from './annotate';
import { runCanvasPage } from '../ui/ReceiptRenderer';

export async function composeAnnotated(src: string, strokes: Stroke[]): Promise<string> {
  const r = await runCanvasPage(annotatePage(src, strokes));
  return `data:image/jpeg;base64,${r.base64}`;
}
