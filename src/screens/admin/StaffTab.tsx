import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isAdmin, type Access } from '../../lib/auth';
import { PERM_GROUPS, ROLE_TONE } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Card, Field, Loading, Note, SectionTitle, SwitchRow, toneColors } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';

type Staff = {
  id: string; login: string; full_name: string; role_id: string; is_active: boolean;
  locked_until: string | null; deleted_at: string | null;
};
type Role = { id: string; name: string; level: number };
type Msg = { tone: 'ok' | 'error'; text: string } | null;

export function StaffTab({ access }: { access: Access }) {
  const { t } = useTheme();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from('staff').select('id, login, full_name, role_id, is_active, locked_until, deleted_at').is('deleted_at', null).order('created_at'),
      supabase.from('roles').select('id, name, level').order('level', { ascending: false }),
    ]);
    if (s.error) setMsg({ tone: 'error', text: s.error.message });
    setStaff((s.data as Staff[]) ?? []);
    setRoles((r.data as Role[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // O'zidan past rollar (Admin hammasini ochishi mumkin)
  const manageableRoles = useMemo(
    () => roles.filter((r) => isAdmin(access) || r.level < access.level),
    [roles, access],
  );
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  if (!staff) return <Loading />;

  return (
    <View style={{ gap: 8 }}>
      {staff.map((s) => (
        <StaffRow
          key={s.id} s={s} me={s.id === access.staff_id} open={open === s.id} roleName={roleName(s.role_id)}
          roles={manageableRoles} canManage={s.id !== access.staff_id && manageableRoles.some((r) => r.id === s.role_id)}
          admin={isAdmin(access)}
          onToggle={() => { setOpen(open === s.id ? null : s.id); setMsg(null); }}
          onMsg={setMsg} reload={load}
        />
      ))}

      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      {adding
        ? <AddStaff roles={manageableRoles} onDone={(m) => { setAdding(false); setMsg(m); load(); }} onCancel={() => setAdding(false)} />
        : <Button kind="soft" icon="plus" label="Xodim qo‘shish" onPress={() => { setAdding(true); setMsg(null); }} />}

      <Note>
        {isAdmin(access)
          ? 'Admin hisobini hech kim o‘chira yoki bloklay olmaydi; tizimda doim kamida bitta Admin qoladi.'
          : 'Siz bu bo‘limda faqat tikuvchi va ustalarni ko‘rasiz va boshqarasiz.'}
      </Note>
      <Text style={{ height: 1, color: t.bg }} />
    </View>
  );
}

function initials(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function StaffRow({ s, me, open, roleName, roles, canManage, admin, onToggle, onMsg, reload }: {
  s: Staff; me: boolean; open: boolean; roleName: string; roles: Role[]; canManage: boolean; admin: boolean;
  onToggle: () => void; onMsg: (m: Msg) => void; reload: () => void;
}) {
  const { t } = useTheme();
  const locked = !!s.locked_until && new Date(s.locked_until) > new Date();
  const tone = !s.is_active || locked ? 'red' : ROLE_TONE[s.role_id] ?? 'grey';
  const [avBg, avFg] = toneColors(t, !s.is_active ? 'grey' : ROLE_TONE[s.role_id] ?? 'grey');
  const status = !s.is_active ? 'bloklangan' : locked ? 'vaqtincha bloklangan' : 'faol';

  const [panel, setPanel] = useState<'none' | 'code' | 'perms' | 'archive'>('none');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    onMsg(error ? { tone: 'error', text: error.message } : { tone: 'ok', text: ok });
    if (!error) { setPanel('none'); setCode(''); reload(); }
  };

  return (
    <Card padded={false} highlighted={open}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, opacity: s.is_active ? 1 : 0.75 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: avBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: avFg, fontSize: 14, fontWeight: '800' }}>{initials(s.full_name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.text }} numberOfLines={1}>{s.full_name}{me ? ' — siz' : ''}</Text>
          <Text style={{ fontSize: 11, color: t.muted }} numberOfLines={1}>{s.login} · {status}</Text>
        </View>
        <Badge label={!s.is_active ? 'Bloklangan' : roleName} tone={tone} />
      </Pressable>

      {open && (
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: t.border, gap: 10 }}>
          {canManage && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Rol</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Rol: ${roleName}`} onPress={() => setRoleOpen(!roleOpen)}
                style={{ minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 15, color: t.text }}>{roleName}</Text>
                <View style={{ transform: [{ rotate: roleOpen ? '-90deg' : '90deg' }] }}><Icon name="chevron" color={t.muted} size={18} /></View>
              </Pressable>
              {roleOpen && (
                <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 8, overflow: 'hidden' }}>
                  {roles.map((r) => (
                    <Pressable key={r.id} accessibilityRole="menuitem" onPress={() => {
                      setRoleOpen(false);
                      if (r.id !== s.role_id) run(() => supabase.from('staff').update({ role_id: r.id }).eq('id', s.id), `Rol "${r.name}" ga o‘zgartirildi.`);
                    }} style={{ padding: 11, backgroundColor: r.id === s.role_id ? t.tealLight : t.card }}>
                      <Text style={{ fontSize: 14, color: r.id === s.role_id ? t.teal : t.text, fontWeight: r.id === s.role_id ? '700' : '400' }}>{r.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(canManage || me) && <Button kind="soft" label="Kodni almashtirish" style={{ flexGrow: 1, flexBasis: '45%' }} onPress={() => setPanel(panel === 'code' ? 'none' : 'code')} />}
            {canManage && admin && <Button kind="soft" label="Shaxsiy ruxsatlar" style={{ flexGrow: 1, flexBasis: '45%' }} onPress={() => setPanel(panel === 'perms' ? 'none' : 'perms')} />}
            {canManage && locked && s.is_active && (
              <Button kind="soft" label="Blokdan chiqarish" style={{ flexGrow: 1, flexBasis: '45%' }} busy={busy}
                onPress={() => run(() => supabase.from('staff').update({ locked_until: null, failed_attempts: 0 }).eq('id', s.id), 'Blokdan chiqarildi.')} />
            )}
            {canManage && (
              <Button kind={s.is_active ? 'danger' : 'soft'} label={s.is_active ? 'Bloklash' : 'Faollashtirish'} style={{ flexGrow: 1, flexBasis: '45%' }} busy={busy}
                onPress={() => run(() => supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id), s.is_active ? 'Xodim bloklandi.' : 'Xodim faollashtirildi.')} />
            )}
            {canManage && <Button kind="danger" label="Arxivga yuborish" style={{ flexGrow: 1, flexBasis: '45%' }} onPress={() => setPanel(panel === 'archive' ? 'none' : 'archive')} />}
          </View>

          {panel === 'code' && (
            <View style={{ gap: 8 }}>
              <Field label="Yangi kod (harf va raqamlar)" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} />
              <Button label="Kodni saqlash" busy={busy} onPress={() => run(() => supabase.rpc('set_staff_code', { p_staff: s.id, p_code: code }), 'Kod almashtirildi. Xodimga yangi kodni ayting.')} />
            </View>
          )}
          {panel === 'archive' && (
            <View style={{ gap: 8 }}>
              <Note tone="error">{`${s.full_name} tizimga kira olmaydi va ro‘yxatdan yo‘qoladi. Admin uni arxivdan qaytara oladi.`}</Note>
              <Button kind="danger" label="Ha, arxivga yuborish" busy={busy}
                onPress={() => run(() => supabase.from('staff').update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', s.id), 'Xodim arxivga yuborildi.')} />
            </View>
          )}
          {panel === 'perms' && <PersonalPerms staffId={s.id} roleId={s.role_id} onMsg={onMsg} />}
        </View>
      )}
    </Card>
  );
}

function PersonalPerms({ staffId, roleId, onMsg }: { staffId: string; roleId: string; onMsg: (m: Msg) => void }) {
  const [base, setBase] = useState<Record<string, boolean> | null>(null);
  const [vals, setVals] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, o] = await Promise.all([
        supabase.from('permissions').select('action, allowed').eq('role_id', roleId),
        supabase.from('staff_overrides').select('action, allowed').eq('staff_id', staffId),
      ]);
      const b: Record<string, boolean> = {};
      (p.data ?? []).forEach((r: { action: string; allowed: boolean }) => { b[r.action] = r.allowed; });
      const v = { ...b };
      (o.data ?? []).forEach((r: { action: string; allowed: boolean }) => { v[r.action] = r.allowed; });
      setBase(b); setVals(v);
    })();
  }, [staffId, roleId]);

  if (!base) return <Loading />;

  const save = async () => {
    setBusy(true);
    const keys = Object.keys(vals);
    const differs = keys.filter((k) => vals[k] !== base[k]);
    const same = keys.filter((k) => vals[k] === base[k]);
    let error: { message: string } | null = null;
    if (differs.length) {
      ({ error } = await supabase.from('staff_overrides')
        .upsert(differs.map((k) => ({ staff_id: staffId, action: k, allowed: vals[k] })), { onConflict: 'staff_id,action' }));
    }
    if (!error && same.length) {
      ({ error } = await supabase.from('staff_overrides').delete().eq('staff_id', staffId).in('action', same));
    }
    setBusy(false);
    onMsg(error ? { tone: 'error', text: error.message } : { tone: 'ok', text: 'Shaxsiy ruxsatlar saqlandi.' });
  };

  return (
    <View style={{ gap: 4 }}>
      <Note>Rol ruxsatidan farq qiladigan joylar shu xodim uchun alohida saqlanadi.</Note>
      {PERM_GROUPS.map((g) => (
        <View key={g.title}>
          <SectionTitle>{g.title}</SectionTitle>
          {g.items.map((it, i) => (
            <SwitchRow key={it.key} label={it.label} value={!!vals[it.key]} last={i === g.items.length - 1}
              hint={vals[it.key] !== base[it.key] ? 'Shaxsiy (roldan farqli)' : undefined}
              onChange={(v) => setVals({ ...vals, [it.key]: v })} />
          ))}
        </View>
      ))}
      <Button label="Saqlash" busy={busy} onPress={save} style={{ marginTop: 8 }} />
    </View>
  );
}

function AddStaff({ roles, onDone, onCancel }: { roles: Role[]; onDone: (m: Msg) => void; onCancel: () => void }) {
  const { t } = useTheme();
  const workerRoles = roles.filter((r) => r.level < 100);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [role, setRole] = useState(workerRoles.find((r) => r.id === 'tikuvchi')?.id ?? workerRoles[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const minLen = role === 'admin' ? 8 : role === 'direktor' ? 6 : 4;

  const save = async () => {
    setErr('');
    if (!name.trim() || !login.trim() || !code) { setErr('Hamma maydonlarni to‘ldiring.'); return; }
    if (!/^[a-z0-9_.-]{2,32}$/.test(login.trim().toLowerCase())) { setErr('Login: 2–32 ta lotin harf, raqam, nuqta yoki chiziqcha.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('create_staff', { p_login: login, p_full_name: name, p_role: role, p_code: code });
    setBusy(false);
    if (error) setErr(error.message.includes('duplicate') ? 'Bu login band. Boshqasini tanlang.' : error.message);
    else onDone({ tone: 'ok', text: `${name} qo‘shildi. Login: ${login.trim().toLowerCase()}. Kodni xodimga o‘zingiz ayting.` });
  };

  return (
    <Card highlighted style={{ gap: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }}>Yangi xodim</Text>
      <Field label="Ism" value={name} onChangeText={setName} />
      <Field label="Login" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} />
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Rol</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {roles.map((r) => (
            <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ checked: role === r.id }} onPress={() => setRole(r.id)}
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: role === r.id ? t.teal : t.border, backgroundColor: role === r.id ? t.primaryButton : t.card, justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: role === r.id ? t.primaryButtonText : t.text }}>{r.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Field label={`Kod (kamida ${minLen} ta harf yoki raqam)`} value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} />
      {!!err && <Note tone="error">{err}</Note>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button kind="soft" label="Bekor qilish" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Qo‘shish" onPress={save} busy={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}
