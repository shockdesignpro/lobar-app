// Brauzer (PWA) versiyasida push yo'q — xabarlar Android ilovasiga keladi.
export type PushTarget = { orderId?: string; screen?: 'payroll' | 'orders' };
export async function registerPush(): Promise<void> {}
export async function unregisterPush(): Promise<void> {}
export function onPushOpen(_cb: (t: PushTarget) => void): () => void { return () => {}; }
