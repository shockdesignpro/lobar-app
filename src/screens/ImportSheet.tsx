// Eski ilovadan ko'chirish oynasi (faqat Admin)
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useProducts } from '../lib/catalog';
import { parseBackup, runImport, summarize, type ImportSummary, type OldBackup } from '../lib/importOld';
import { reloadOrders } from '../lib/orders';
import { Button, Note, Sheet } from '../ui/components';
import { useTheme } from '../ui/ThemeContext';

function pickJson(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.onchange = async () => { const f = input.files?.[0]; input.remove(); resolve(f ? await f.text() : null); };
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    document.body.appendChild(input);
    input.click();
  });
}

export function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { items: catalog } = useProducts();
  const [data, setData] = useState<OldBackup | null>(null);
  const [info, setInfo] = useState<ImportSummary | null>(null);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ summary: ImportSummary; errors: string[] } | null>(null);

  const choose = () => {
    setErr(''); setResult(null);
    pickJson().then((text) => {
      if (!text) return;
      try { const b = parseBackup(text); setData(b); setInfo(summarize(b)); } catch (e) { setData(null); setInfo(null); setErr(e instanceof Error ? e.message : 'Xato'); }
    });
  };
  const start = async () => {
    if (!data || !catalog) return;
    setProgress({ done: 0, total: data.orders.length });
    const r = await runImport(data, catalog, (done, total) => setProgress({ done, total }));
    setProgress(null); setResult(r); setData(null); setInfo(null);
    void reloadOrders();
  };
  const close = () => { if (progress) return; setData(null); setInfo(null); setResult(null); setErr(''); onClose(); };

  return (
    <Sheet visible={visible} onClose={close} title="Eski ilovadan ko‘chirish">
      <View style={{ gap: 12 }}>
        {Platform.OS !== 'web' ? (
          <Note>Ko‘chirish kompyuterda, ilovaning brauzer versiyasida bajariladi: eski ilovada “Zaxira olish” bilan olingan faylni shu yerda tanlaysiz.</Note>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: t.muted, lineHeight: 19 }}>
              Eski ilovada: Sozlamalar → Umumiy sozlamalar → “Zaxira nusxa olish”. Hosil bo‘lgan parda_zaxira_….json faylini shu yerda tanlang.
              Buyurtmalar, to‘lovlar, ish holati va andoza rasmlari ko‘chiriladi. Faylni ikki marta yuklasangiz ham buyurtmalar ikkilanmaydi.
            </Text>
            {!progress && <Button kind="soft" icon="upload" label="Zaxira faylini tanlash" onPress={choose} />}
            {err ? <Note tone="error">{err}</Note> : null}
            {info && !progress && (
              <>
                <Note>
                  {`Faylda: ${info.orders} ta buyurtma, ${info.payments} ta to‘lov, ${info.photos} ta rasm.`}
                  {info.skipped ? ` ${info.skipped} ta bo‘sh buyurtma o‘tkazib yuboriladi.` : ''}
                </Note>
                <Button label="Ko‘chirishni boshlash" icon="cloud" onPress={start} disabled={!catalog} />
              </>
            )}
            {progress && <Note>{`Ko‘chirilmoqda: ${progress.done} / ${progress.total}… Oynani yopmang.`}</Note>}
            {result && (
              <>
                <Note tone={result.errors.length ? 'error' : 'ok'}>
                  {`Ko‘chirildi: ${result.summary.orders} ta buyurtma, ${result.summary.payments} ta to‘lov, ${result.summary.photos} ta rasm.`}
                </Note>
                {result.errors.slice(0, 20).map((e, i) => <Text key={i} style={{ fontSize: 12, color: t.red }}>{e}</Text>)}
              </>
            )}
          </>
        )}
      </View>
    </Sheet>
  );
}
