// Andoza rasmlari maxfiy papkada saqlanadi: ko'rsatish uchun 1 soatlik vaqtinchalik havola olinadi.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const need = paths.filter((p) => { const c = cache.get(p); return !c || c.exp < now + 60_000; });
  if (need.length) {
    try {
      const { data } = await supabase.storage.from('order-photos').createSignedUrls(need, 3600);
      for (const d of data ?? []) if (d.signedUrl && d.path) cache.set(d.path, { url: d.signedUrl, exp: now + 3_500_000 });
    } catch { /* internet yo'q */ }
  }
  const out: Record<string, string> = {};
  for (const p of paths) { const c = cache.get(p); if (c) out[p] = c.url; }
  return out;
}

export function usePhotoUrls(paths: string[]) {
  const key = paths.join('|');
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of paths) { const c = cache.get(p); if (c) out[p] = c.url; }
    return out;
  });
  useEffect(() => {
    let alive = true;
    if (paths.length) signedUrls(paths).then((u) => { if (alive) setUrls(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
