import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtN, fmtSom } from '../../lib/format';
import { costGroups, mqText, roomDimensions, totals, type Draft, type Section } from '../../lib/order/model';
import { Card } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';
import { SectionHeader } from './parts';

export function StepSummary({ draft }: { draft: Draft }) {
  const { t, mode } = useTheme();
  const tot = totals(draft);
  const groups = costGroups(draft);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const line = (label: string, value: number, icon: 'box' | 'scissors' | 'wrench') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Icon name={icon} color="rgba(255,255,255,0.8)" size={14} />
      <Text style={{ flex: 1, marginLeft: 6, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>{fmtSom(value)}</Text>
    </View>
  );

  return (
    <>
      <LinearGradient colors={mode === 'dark' ? ['#19372c', '#254c3d'] : ['#095c47', '#1a9e7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 15, padding: 16 }}>
        {line('Xarajatlar jami', tot.mahsulot, 'box')}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginVertical: 4 }} />
        {line('Tikish xizmati', tot.tikish, 'scissors')}
        {line('O‘rnatish xizmati', tot.ustanovka, 'wrench')}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginTop: 8 }}>
          <Text style={{ flex: 1, color: '#ffffff', fontWeight: '800', fontSize: 14 }}>Xizmat haqi jami</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>{fmtSom(tot.xizmat)}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 14, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: '#ffffff', fontWeight: '800', fontSize: 18 }}>JAMI</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 22 }}>{fmtSom(tot.grand)}</Text>
        </View>
      </LinearGradient>

      <SectionHeader icon="file" title="Batafsil" />
      {groups.map((g, gi) => {
        const key = g.room?.id ?? 'other';
        const isOpen = !!open[key];
        return (
          <Card key={key} padded={false}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen({ ...open, [key]: !isOpen })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
              <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><Icon name="chevron" color={t.teal} size={16} strokeWidth={2.4} /></View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: t.text }}>{gi + 1}. {g.name}</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: t.text }}>{fmtSom(g.grand)}</Text>
            </Pressable>
            {isOpen && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 6 }}>
                <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>{g.room ? roomDimensions(g.room) : 'Xonaga biriktirilmagan xarajatlar'}</Text>
                {(['mahsulot', 'tikish', 'ustanovka'] as Section[]).map((s, i) => (
                  <View key={s} style={{ gap: 4, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: t.divider }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: t.text }}>{['Xarajatlar', 'Tikish', 'O‘rnatish'][i]}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: t.text }}>{fmtSom(g.sums[s])}</Text>
                    </View>
                    {g.rows[s].length ? g.rows[s].map((r) => (
                      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, color: t.text }}>{r.productName}</Text>
                          <Text style={{ fontSize: 11, color: t.muted }}>{fmtN(r.price)} × {mqText(r.qty)}</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: t.text }}>{fmtSom((r.qty ?? 0) * r.price)}</Text>
                      </View>
                    )) : <Text style={{ fontSize: 12, color: t.muted }}>Kiritilmagan</Text>}
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}
