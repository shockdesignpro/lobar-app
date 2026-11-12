-- ============================================================
-- Lobar Parda — 0012: o'z kodini almashtirish eski kodni so'raydi
--  * Eski kod noto'g'ri bo'lsa — urinish hisoblanadi (kirishdagidek: 5 marta xato -> 15 daqiqa blok).
--  * Yangi kod uzunligi lavozimga qarab tekshiriladi (Admin 8, Direktor 6, ishchi 4 belgi).
--  * Kodning o'zi hech qayerda saqlanmaydi — faqat xeshi.
-- ============================================================
create or replace function public.change_my_code(p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.staff%rowtype;
  v_hash text;
  v_max int := coalesce((select (value)::text::int from public.app_settings where key = 'login_max_attempts'), 5);
  v_lock int := coalesce((select (value)::text::int from public.app_settings where key = 'login_lock_minutes'), 15);
begin
  select * into s from public.staff where id = public.current_staff_id() and deleted_at is null;
  if not found then raise exception 'Avval tizimga kiring'; end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', s.locked_until);
  end if;
  select code_hash into v_hash from public.staff_secrets where staff_id = s.id;
  if v_hash is null or extensions.crypt(coalesce(p_old, ''), v_hash) <> v_hash then
    if s.failed_attempts + 1 >= v_max then
      update public.staff set failed_attempts = 0, locked_until = now() + make_interval(mins => v_lock) where id = s.id;
      insert into public.audit_log (staff_id, table_name, row_id, action) values (s.id, 'staff', s.id::text, 'LOGIN_LOCKED');
      return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + make_interval(mins => v_lock));
    end if;
    update public.staff set failed_attempts = s.failed_attempts + 1 where id = s.id;
    return jsonb_build_object('ok', false, 'reason', 'wrong_old', 'remaining', v_max - s.failed_attempts - 1);
  end if;
  if p_new = p_old then
    return jsonb_build_object('ok', false, 'reason', 'same');
  end if;
  perform public.assert_valid_code(s.role_id, p_new);
  update public.staff_secrets set code_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), updated_at = now() where staff_id = s.id;
  update public.staff set failed_attempts = 0, locked_until = null where id = s.id;
  insert into public.audit_log (staff_id, table_name, row_id, action, new_data)
    values (s.id, 'staff_secrets', s.id::text, 'CODE_CHANGE', null);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.change_my_code(text, text) from public, anon;
grant execute on function public.change_my_code(text, text) to authenticated;
