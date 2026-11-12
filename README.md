# Lobar Parda — yangi ilova

Android, iOS va veb uchun bitta ilova: Expo (React Native) + TypeScript + Supabase.
Texnik topshiriq: "Lobar Parda — yangi ilova texnik topshirig'i" hujjati.

## 1. Baza (Supabase → SQL Editor → New query → Run)

Fayllarni tartib bilan, har birini bir marta ishga tushiring:

1. `supabase/migrations/0001_init.sql` — jadvallar, rollar, ruxsatlar (bajarilgan)
2. `supabase/migrations/0002_auth.sql` — shaxsiy kod bilan kirish
3. `supabase/migrations/0003_fix_code_check.sql` — kod almashtirish tekshiruvi
4. `supabase/migrations/0004_code_letters.sql` — kodda harflar ham bo'lishi mumkin
5. `supabase/migrations/0005_save_order.sql` — buyurtmani saqlash
6. `supabase/migrations/0006_offline_photos.sql` — internetsiz ishlash, andoza rasmlari, eski ma'lumotlarni ko'chirish
7. `supabase/migrations/0007_payroll.sql` — ishchilar ish haqi (ishbay)
8. `supabase/migrations/0008_expenses.sql` — xarajatlar va sof foyda
9. `supabase/migrations/0009_payroll_fix.sql` — ish haqi hisobini tuzatish

## 2. Kirish xizmati (staff-login)

Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**:

- Nomi: `staff-login`
- Ichidagi kodni o'chirib, `supabase/functions/staff-login/index.ts` faylidagi hamma matnni qo'ying → **Deploy**.
- Funksiya sozlamalarida (**Details** yoki **Settings**) **Verify JWT / Enforce JWT verification** ni **o'chiring** va saqlang.

## 3. Birinchi Admin (bir marta)

SQL Editor'da (login, ism va kodni o'zingiznikiga almashtiring; kod kamida 8 ta belgi, harf va raqam, bo'sh joysiz):

```sql
select public.bootstrap_admin('login', 'Ismingiz', 'kod');
```

Bu buyruq faqat tizimda hali Admin bo'lmasa ishlaydi. Kodni hech kimga yubormang.

## 4. Kompyuterda ishga tushirish

`F:\lobar-app` papkasida terminal:

```
npm.cmd install
npx.cmd expo start
```

Brauzer: terminalda `w`. Telefon: Expo Go bilan QR kod (kompyuter va telefonda bir xil Expo hisobi).

## Tuzilma

| Joy | Nima |
| --- | --- |
| `App.tsx` | Kirish, avtomatik qulflash, ekranlar o'rtasida o'tish |
| `src/screens/` | Kirish, bosh sahifa, admin panel (xodimlar, ruxsatlar, tarix) |
| `src/ui/` | Umumiy komponentlar, ikonkalar, yorug'/tungi rejim |
| `src/lib/` | Supabase ulanishi, kirish, ruxsatlar ro'yxati |
| `src/theme.ts` | Eski ilovadan ko'chirilgan ranglar |
| `src/config.ts` | Supabase manzili va publishable key (service_role key bu yerga yozilmaydi) |
| `supabase/migrations/` | Baza sxemasi va xavfsizlik qoidalari |
| `supabase/functions/staff-login/` | Login + kodni tekshiruvchi server funksiyasi |

Dizayn qoidalari: hozirgi dizayn saqlanadi; shtrix chiziq yo'q; hamma ekran responsive, eniga aylantirish yo'q.
