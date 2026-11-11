-- ============================================================
-- Lobar Parda — 0003: set_staff_code tekshiruvini kuchaytirish
-- Xodim hisobiga bog'lanmagan foydalanuvchi boshqa xodimning kodini
-- almashtira olmasligi uchun (NULL taqqoslash tuzatildi).
-- ============================================================
create or replace function public.set_staff_code(p_staff uuid, p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  if public.current_staff_id() is null then
    raise exception 'Avval tizimga kiring';
  end if;
  select role_id into v_role from public.staff where id = p_staff and deleted_at is null;
  if v_role is null then raise exception 'Xodim topilmadi'; end if;
  if p_staff is distinct from public.current_staff_id() and not public.can_manage_role(v_role) then
    raise exception 'Bu xodimning kodini almashtirishga ruxsatingiz yo''q';
  end if;
  perform public.assert_valid_code(v_role, p_code);
  update public.staff_secrets set code_hash = extensions.crypt(p_code, extensions.gen_salt('bf')), updated_at = now()
    where staff_id = p_staff;
  update public.staff set failed_attempts = 0, locked_until = null where id = p_staff;
  insert into public.audit_log (staff_id, table_name, row_id, action, new_data)
    values (public.current_staff_id(), 'staff_secrets', p_staff::text, 'CODE_CHANGE', null);
end $$;
