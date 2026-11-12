// Rasm ustiga qalam bilan chizish (andoza rasmlarida): rang, qalinlik, oxirgisini qaytarish, tozalash.
// Saqlanganda chiziqlar rasm bilan birlashtirilib, yangi JPG bo'ladi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { PEN_COLORS, PEN_SIZES, type Stroke } from '../lib/annotate';
import { composeAnnotated } from '../lib/annotateCompose';
import { Button } from './components';
import { Icon } from './Icon';
import { useSnack } from './SnackContext';
import { useTheme } from './ThemeContext';

export function PhotoAnnotator({ src, onClose, onSave }: { src: string; onClose: () => void; onSave: (dataUrl: string) => void }) {
  const { t } = useTheme();
  const snack = useSnack();
  const { width: sw, height: sh } = useWindowDimensions();
  const [ratio, setRatio] = useState<number | null>(null); // eni / bo'yi
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Stroke | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].key);
  const [size, setSize] = useState(PEN_SIZES[1].key);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Image.getSize(src, (w, h) => setRatio(w / h), () => { setRatio(1); snack('Rasm o‘lchami aniqlanmadi'); });
  }, [src, snack]);

  // Rasm maydoni: ekranga sig'adigan eng katta o'lcham (tepada sarlavha, pastda asboblar)
  const box = useMemo(() => {
    const maxW = Math.min(sw - 24, 900);
    const maxH = Math.max(200, sh - 300);
    if (!ratio) return { w: maxW, h: maxW };
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w: Math.round(w), h: Math.round(h) };
  }, [sw, sh, ratio]);

  const cur = useRef<Stroke | null>(null);
  const pen = useRef({ color, size, box });
  pen.current = { color, size, box };
  const pt = (x: number, y: number) => [Math.min(1, Math.max(0, x / pen.current.box.w)), Math.min(1, Math.max(0, y / pen.current.box.h))];

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      cur.current = { color: pen.current.color, width: pen.current.size, points: pt(e.nativeEvent.locationX, e.nativeEvent.locationY) };
      setLive({ ...cur.current });
    },
    onPanResponderMove: (e) => {
      if (!cur.current) return;
      cur.current.points.push(...pt(e.nativeEvent.locationX, e.nativeEvent.locationY));
      setLive({ ...cur.current, points: [...cur.current.points] });
    },
    onPanResponderRelease: () => {
      const s = cur.current; cur.current = null; setLive(null);
      if (s) setStrokes((list) => [...list, s]);
    },
    onPanResponderTerminate: () => {
      const s = cur.current; cur.current = null; setLive(null);
      if (s) setStrokes((list) => [...list, s]);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const pathOf = (s: Stroke) => {
    const p = s.points; let d = `M ${p[0] * box.w} ${p[1] * box.h}`;
    for (let i = 2; i < p.length; i += 2) d += ` L ${p[i] * box.w} ${p[i + 1] * box.h}`;
    return d;
  };
  const draw = (s: Stroke, k: string) => (s.points.length === 2
    ? <Circle key={k} cx={s.points[0] * box.w} cy={s.points[1] * box.h} r={Math.max(1, s.width * box.w) / 2} fill={s.color} />
    : <Path key={k} d={pathOf(s)} stroke={s.color} strokeWidth={Math.max(1, s.width * box.w)} strokeLinecap="round" strokeLinejoin="round" fill="none" />);

  const save = async () => {
    if (!strokes.length) { onClose(); return; }
    setBusy(true);
    try { onSave(await composeAnnotated(src, strokes)); }
    catch (e) { snack('Saqlanmadi: ' + (e instanceof Error ? e.message : '')); }
    setBusy(false);
  };

  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1d1c' }} edges={['top', 'bottom', 'left', 'right']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={onClose}
              style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" color="#ffffff" strokeWidth={1.9} />
            </Pressable>
            <Text style={{ flex: 1, color: '#ffffff', fontSize: 17, fontWeight: '800' }}>Rasmga chizish</Text>
            <ToolBtn label="Oxirgisini qaytarish" icon="undo" disabled={!strokes.length} onPress={() => setStrokes((l) => l.slice(0, -1))} />
            <ToolBtn label="Hammasini tozalash" icon="trash" disabled={!strokes.length} onPress={() => setStrokes([])} />
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: box.w, height: box.h }} {...responder.panHandlers}>
              <Image source={{ uri: src }} style={{ width: box.w, height: box.h }} resizeMode="stretch" />
              <Svg width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                {strokes.map((s, i) => draw(s, String(i)))}
                {live && draw(live, 'live')}
              </Svg>
            </View>
          </View>

          <View style={{ padding: 12, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              {PEN_COLORS.map((c) => (
                <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`${c.label} rang`} accessibilityState={{ selected: color === c.key }} onPress={() => setColor(c.key)}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.key, borderWidth: color === c.key ? 3 : 1, borderColor: color === c.key ? t.teal === '#0d7a5f' ? '#3ddc97' : t.teal : 'rgba(255,255,255,0.4)' }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {PEN_SIZES.map((z) => (
                <Pressable key={z.key} accessibilityRole="button" accessibilityState={{ selected: size === z.key }} onPress={() => setSize(z.key)}
                  style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: size === z.key ? '#ffffff' : 'rgba(255,255,255,0.3)', backgroundColor: size === z.key ? 'rgba(255,255,255,0.15)' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 6 + z.key * 400, height: 6 + z.key * 400, borderRadius: 20, backgroundColor: color }} />
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>{z.label}</Text>
                </Pressable>
              ))}
            </View>
            <Button label={strokes.length ? 'Saqlash' : 'Yopish'} icon={strokes.length ? 'check' : undefined} onPress={save} busy={busy} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function ToolBtn({ label, icon, onPress, disabled }: { label: string; icon: 'undo' | 'trash'; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} color="#ffffff" size={19} />
    </Pressable>
  );
}
