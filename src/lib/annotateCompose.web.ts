import { composeInBrowser, type Stroke } from './annotate';
export const composeAnnotated = (src: string, strokes: Stroke[]) => composeInBrowser(src, strokes);
