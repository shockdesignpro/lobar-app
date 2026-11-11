import { Pressable, Text, View } from 'react-native';
import { fmtSom } from '../../lib/format';
import { displayDate, payStatus, remaining, stage, type OrderListItem } from '../../lib/orders';
import { Badge } from '../../ui/components';
import { Icon, type IconName } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';

export function MiniAction({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: t.border, backgroundColor: pressed ? (danger ? t.redLight : t.tealLight) : t.card, alignItems: 'center', justifyContent: 'center' })}>
      <Icon name={icon} color={danger ? t.red : t.teal} size={16} />
    </Pressable>
  );
}

/** Buyurtma kartasining yuqori qismi (eski orderCardHeader) */
export function OrderHead({ o, onOpen, actions, showMoney }: { o: OrderListItem; onOpen?: () => void; actions?: React.ReactNode; showMoney: boolean }) {
  const { t } = useTheme();
  const st = stage(o);
  const ps = payStatus(o);
  const head = (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '600', color: t.teal }}>{(o.client_name || 'M').trim().slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.text }} numberOfLines={2}>{o.client_name}</Text>
        {!!o.client_phone && <Text style={{ fontSize: 12, color: t.muted }}>{o.client_phone}</Text>}
        <Text style={{ fontSize: 11, color: t.muted }}>Topshirish: {displayDate(o.ready_date)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          <Badge label={st} tone={st === 'Tayyor' || st === 'O‘rnatildi' ? 'teal' : 'teal'} />
          {showMoney && <Badge label={ps === 'full' ? 'To‘langan' : ps === 'partial' ? 'Qisman to‘langan' : 'To‘lanmagan'} tone={ps === 'full' ? 'teal' : 'amber'} />}
        </View>
      </View>
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {onOpen ? <Pressable accessibilityRole="button" accessibilityLabel={`${o.client_name} buyurtmasi`} onPress={onOpen}>{head}</Pressable> : head}
        </View>
        {actions && <View style={{ flexDirection: 'row', gap: 4 }}>{actions}</View>}
      </View>
      {showMoney && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: t.divider }}>
          <Text style={{ fontSize: 12, color: t.muted }}>Qoldiq: {fmtSom(remaining(o))}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: t.teal }}>{fmtSom(o.total ?? 0)}</Text>
        </View>
      )}
    </View>
  );
}
