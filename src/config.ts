// Supabase ulanishi. Bu ikki qiymat ilovada ochiq turishi uchun mo'ljallangan (publishable key).
// DIQQAT: service_role / secret key va baza parolini HECH QACHON shu faylga yozmang.
// Xohlasangiz .env fayldagi EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY bularni almashtiradi.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dhhcerhkttdenpagocxw.supabase.co';
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_F2vP-24kr0VPgQt43P6wng_xaXQ0hiN';

// Supabase'dagi kirish funksiyasining nomi (Edge Functions ro'yxatidagi nom)
export const STAFF_LOGIN_FUNCTION = 'super-processor';
