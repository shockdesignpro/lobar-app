// Andoza rasmlari: buyurtma kiritishda tanlash, kartada kichik rasm, batafsil ko'rinishda galereya.
import { useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { Photo } from '../lib/order/model';
import { usePhotoUrls } from '../lib/photoUrls';
import { pickPhotos } from '../lib/photos';
import { Card } from './components';
import { Icon } from './Icon';
import { PhotoAnnotator } from './PhotoAnnotator';
import { useSnack } from './SnackContext';
import { useTheme } from './ThemeContext';

const TILE = '31.5%';

export function PhotoEditor({ photos, onChange }: { photos: Photo[]; onChange: (fn: (p: Photo[]) => Photo[]) => void }) {
  const { t } = useTheme();
  const snack = useSnack();
  const urls = usePhotoUrls(photos.filter((p) => !p.uri && p.path).map((p) => p.path as string));
  const [view, setView] = useState<number | null>(null);
  const [drawIdx, setDrawIdx] = useState<number | null>(null);

  const add = (source: 'library' | 'camera') => {
    pickPhotos(source).then((list) => {
      if (!list.length) return;
      const start = photos.length;
      onChange((p) => [...p, ...list.map((uri) => ({ path: null, uri, caption: '' }))]);
      // Kamerada olingan rasm ustiga darhol chizish mumkin
      if (source === 'camera' && list.length === 1) setTimeout(() => setDrawIdx(start), 0);
      else snack(`${list.length} ta rasm qo‘shildi — ustiga chizish uchun qalam belgisini bosing`);
    }).catch((e) => snack(e instanceof Error ? e.message : 'Rasm olinmadi'));
  };
  const src = (p: Photo) => p.uri || (p.path ? urls[p.path] : '') || '';

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PickBtn icon="image" label="Galereyadan" onPress={() => add('library')} />
        <PickBtn icon="camera" label="Kamerada olish" onPress={() => add('camera')} />
      </View>
      {photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p, i) => (
            <View key={`${p.path ?? ''}${i}`} style={{ width: TILE, gap: 6 }}>
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Andoza ${i + 1}`} onPress={() => setView(i)}
                style={{ aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: t.greyLight, borderWidth: 1, borderColor: t.border }}>
                {src(p) ? <Image source={{ uri: src(p) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Placeholder />}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Andozani olib tashlash" onPress={() => onChange((list) => list.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" color="#ffffff" size={14} strokeWidth={2.4} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Rasm ustiga chizish" onPress={() => setDrawIdx(i)}
                style={{ position: 'absolute', top: 5, left: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pen" color="#ffffff" size={14} strokeWidth={2.2} />
              </Pressable>
              <TextInput accessibilityLabel="Andoza izohi" value={p.caption} placeholder="Izoh yozing" placeholderTextColor={t.muted}
                onChangeText={(v) => onChange((list) => list.map((x, j) => (j === i ? { ...x, caption: v } : x)))}
                style={{ minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, color: t.text, fontSize: 12, paddingLeft: 8, paddingRight: 8 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="image" color={t.muted} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }}>Tanlangan andozalar</Text>
            <Text style={{ fontSize: 12, color: t.muted, marginTop: 2, lineHeight: 17 }}>Buyurtma kartasida ham shu rasm ko‘rinadi.</Text>
          </View>
        </View>
      )}
      <PhotoViewer items={photos.map((p) => ({ src: src(p), caption: p.caption }))} index={view} onIndex={setView} />
      {drawIdx != null && photos[drawIdx] && src(photos[drawIdx]) ? (
        <PhotoAnnotator src={src(photos[drawIdx])} onClose={() => setDrawIdx(null)}
          onSave={(uri) => {
            const i = drawIdx;
            // Chizilgan rasm yangi rasm sifatida saqlanadi (buyurtma saqlanganda yuklanadi)
            onChange((list) => list.map((x, j) => (j === i ? { ...x, path: null, uri } : x)));
            setDrawIdx(null); snack('Rasm saqlandi');
          }} />
      ) : null}
    </Card>
  );
}

function PickBtn({ icon, label, onPress }: { icon: 'image' | 'camera'; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: t.teal, backgroundColor: t.tealLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} color={t.teal} size={17} />
      <Text style={{ color: t.teal, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Placeholder() {
  const { t } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" color={t.muted} size={24} /></View>;
}

/** Buyurtma tafsilotidagi andozalar (faqat ko'rish) */
export function PhotoGallery({ paths, captions, local }: { paths: string[]; captions: string[]; local?: Record<string, string> }) {
  const { t } = useTheme();
  const urls = usePhotoUrls(paths.filter((p) => !local?.[p]));
  const [view, setView] = useState<number | null>(null);
  if (!paths.length) return null;
  const src = (p: string) => local?.[p] || urls[p] || '';
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="image" color={t.text} size={17} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: t.text }}>Andozalar</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {paths.map((p, i) => (
          <Pressable key={p} accessibilityRole="imagebutton" accessibilityLabel={captions[i] || `Andoza ${i + 1}`} onPress={() => setView(i)} style={{ width: TILE, gap: 4 }}>
            <View style={{ aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: t.greyLight, borderWidth: 1, borderColor: t.border }}>
              {src(p) ? <Image source={{ uri: src(p) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Placeholder />}
            </View>
            {!!captions[i] && <Text style={{ fontSize: 11, color: t.muted }} numberOfLines={2}>{captions[i]}</Text>}
          </Pressable>
        ))}
      </View>
      <PhotoViewer items={paths.map((p, i) => ({ src: src(p), caption: captions[i] ?? '' }))} index={view} onIndex={setView} />
    </View>
  );
}

/** Kartadagi kichik rasm (birinchi andoza) */
export function PhotoThumb({ path, size = 48 }: { path: string; size?: number }) {
  const { t } = useTheme();
  const urls = usePhotoUrls([path]);
  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: t.tealLight }}>
      {urls[path] ? <Image accessibilityLabel="Tanlangan parda andozasi" source={{ uri: urls[path] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" color={t.teal} size={20} /></View>}
    </View>
  );
}

/** To'liq ekranda ko'rish (eski "rasm ko'ruvchi") */
export function PhotoViewer({ items, index, onIndex }: { items: { src: string; caption: string }[]; index: number | null; onIndex: (i: number | null) => void }) {
  if (index == null || !items[index]) return null;
  const it = items[index];
  const nav = (d: number) => onIndex((index + d + items.length) % items.length);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onIndex(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => onIndex(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {it.src ? <Image source={{ uri: it.src }} style={{ width: '100%', height: '75%' }} resizeMode="contain" /> : null}
        {!!it.caption && <Text style={{ color: '#ffffff', fontSize: 15, textAlign: 'center', marginTop: 12 }}>{it.caption}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          {items.length > 1 && <ViewerBtn label="Oldingi" onPress={() => nav(-1)} flip />}
          <ViewerBtn label="Yopish" onPress={() => onIndex(null)} />
          {items.length > 1 && <ViewerBtn label="Keyingi" onPress={() => nav(1)} />}
        </View>
      </View>
    </Modal>
  );
}
function ViewerBtn({ label, onPress, flip }: { label: string; onPress: () => void; flip?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', flexDirection: flip ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
