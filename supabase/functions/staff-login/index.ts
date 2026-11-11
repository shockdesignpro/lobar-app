// Lobar Parda — staff-login
// Login + shaxsiy kodni tekshiradi va Supabase sessiyasini qaytaradi.
// Supabase'da "Verify JWT" (Enforce JWT verification) O'CHIQ bo'lishi kerak:
// bu funksiya hali kirmagan foydalanuvchi tomonidan chaqiriladi.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST kerak' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Server sozlanmagan: service key topilmadi' });

  let login = '', code = '';
  try {
    const body = await req.json();
    login = String(body.login ?? '').trim().toLowerCase();
    code = String(body.code ?? '').trim();
  } catch {
    return json(400, { error: 'Noto‘g‘ri so‘rov' });
  }
  if (!login || !code) return json(400, { error: 'Login va kodni kiriting' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: check, error: checkErr } = await admin.rpc('staff_check_code', { p_login: login, p_code: code });
  if (checkErr) return json(500, { error: 'Tekshirishda xato: ' + checkErr.message });

  if (!check?.ok) {
    if (check?.reason === 'locked') {
      return json(423, { error: 'Juda ko‘p noto‘g‘ri urinish. Hisob vaqtincha bloklangan.', locked_until: check.locked_until });
    }
    if (check?.reason === 'blocked') return json(403, { error: 'Bu hisob bloklangan. Rahbaringizga murojaat qiling.' });
    const remaining = typeof check?.remaining === 'number' ? check.remaining : null;
    return json(401, {
      error: remaining !== null ? `Login yoki kod noto‘g‘ri. Yana ${remaining} ta urinish qoldi.` : 'Login yoki kod noto‘g‘ri.',
      remaining,
    });
  }

  // Birinchi kirishda xodim uchun Supabase Auth foydalanuvchisini yaratamiz
  let authUserId: string | null = check.auth_user_id;
  if (!authUserId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: check.email,
      password: check.secret,
      email_confirm: true,
      app_metadata: { staff_id: check.staff_id },
    });
    if (createErr || !created.user) return json(500, { error: 'Hisob yaratilmadi: ' + (createErr?.message ?? '') });
    authUserId = created.user.id;
    const { error: linkErr } = await admin.rpc('staff_link_auth', { p_staff: check.staff_id, p_auth_user: authUserId });
    if (linkErr) return json(500, { error: 'Hisob bog‘lanmadi: ' + linkErr.message });
  }

  const signer = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signErr } = await signer.auth.signInWithPassword({ email: check.email, password: check.secret });
  if (signErr || !signed.session) return json(500, { error: 'Sessiya ochilmadi: ' + (signErr?.message ?? '') });

  return json(200, {
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  });
});
