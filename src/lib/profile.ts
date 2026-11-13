// Shaxsiy profil: ism va rasm (har kim faqat o'zinikini o'zgartiradi — 0014_profile_trash.sql)
import { dataToBytes, isNetworkError } from './offline';
import { supabase } from './supabase';

/** Profil rasmining manzili (ochiq papka) */
export const avatarUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * avatar: undefined — o'zgarmaydi, null — olib tashlanadi, "data:image/..." — yangi rasm yuklanadi.
 * Internet kerak (profil o'zgarishi navbatga qo'yilmaydi).
 */
export async function saveProfile(staffId: string, fullName: string, avatar: string | null | undefined, oldPath?: string | null) {
  try {
    let path: string | null | undefined;
    if (avatar === null) path = '';
    else if (avatar) {
      path = `${staffId}/${rid()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, dataToBytes(avatar), { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
    }
    const { error } = await supabase.rpc('update_my_profile', { p_full_name: fullName, p_avatar: path ?? null });
    if (error) throw error;
    // Eski rasmni o'chiramiz (o'tmasa ham zarari yo'q)
    if (oldPath && path !== undefined) void supabase.storage.from('avatars').remove([oldPath]).then(() => {}, () => {});
    return { ok: true as const };
  } catch (e) {
    const msg = (e as { message?: string }).message ?? 'Xato';
    return { ok: false as const, error: isNetworkError(e) ? 'Internet yo‘q. Profilni internet bor paytda saqlang.' : msg };
  }
}
