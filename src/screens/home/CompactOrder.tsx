// Ixcham buyurtma kartasi (eski mobileCompactOrder): bosh sahifa va hisobotda
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fmtSom } from '../../lib/format';
import { displayDate, isLate, remaining, stage, type OrderListItem } from '../../lib/orders';
import { Badge, Card } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';

export function CompactOrder({ o, showDebt, showMoney, onPress }: { o: OrderListItem; showDebt?: boolean; showMoney: boolean; onPress: () => void }) {
  const { t } = useTheme();
  const st = stage(o);
  const late = isLate(o);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${o.client_name}, ${st}`} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '600', color: t.teal }}>{(o.client_name || 'M').trim().slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: t.text }} numberOfLines={1}>{o.client_name}</Text>
          <Badge label={st} tone={late ? 'red' : st === 'Tayyor' || st === 'O‘rnatildi' ? 'teal' : 'amber'} />
        </View>
        <Text style={{ fontSize: 11, color: t.muted }}>{late ? 'Muddat o‘tgan · ' : 'Topshirish · '}{displayDate(o.ready_date)}</Text>
        {showMoney && <Text style={{ fontSize: 13, fontWeight: '700', color: t.teal }}>{showDebt ? `Qoldiq: ${fmtSom(remaining(o))}` : fmtSom(o.total ?? 0)}</Text>}
      </View>
    </Pressable>
  );
}

export function SectionTitle({ title, onAll }: { title: string; onAll?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800', color: t.text }}>{title}</Text>
      {onAll && (
        <Pressable accessibilityRole="button" onPress={onAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t.teal }}>Barchasi</Text>
          <Icon name="arrowRight" color={t.teal} size={12} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

export function EmptyCard({ title, text }: { title: string; text: string }) {
  const { t } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16 }}>
      <Icon name="inbox" color={t.muted} size={26} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>{text}</Text>
      </View>
    </Card>
  );
}

/** Eski bosh sahifadagi parda rasmi */
export function CurtainArt({ color }: { color: string }) {
  return (
    <Svg width={108} height={94} viewBox="0 0 160 140" fill="none">
      <Path d="M18 16H142M24 22V124H136V22M80 22V124M24 74H136" stroke={color} strokeWidth={1.5} />
      <Path d="M20 20H66C65 55 53 83 20 90V20ZM140 20H94C95 55 107 83 140 90V20Z" fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
      <Path d="M33 21C34 54 29 69 21 80M47 21C47 57 37 77 21 86M127 21C126 54 131 69 139 80M113 21C113 57 123 77 139 86M20 91L32 123H20V91ZM140 91L128 123H140V91Z" stroke={color} />
      <Path d="M70 128H90" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
