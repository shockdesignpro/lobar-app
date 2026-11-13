// Xodim rasmi: rasm bo'lsa — rasm, bo'lmasa ism bosh harfi
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { avatarUrl } from '../lib/profile';
import { useTheme } from './ThemeContext';

export function Avatar({ name, path, size = 40, uri }: { name: string; path?: string | null; size?: number; uri?: string | null }) {
  const { t } = useTheme();
  const [broken, setBroken] = useState<string | null>(null);
  const src = uri ?? avatarUrl(path);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (src && broken !== src) {
    return <Image source={{ uri: src }} style={[box, { backgroundColor: t.tealLight }]} onError={() => setBroken(src)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[box, { backgroundColor: t.teal, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#ffffff', fontSize: Math.round(size * 0.4), fontWeight: '800' }}>{(name || '?').trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}
