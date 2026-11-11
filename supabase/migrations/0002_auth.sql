-- ============================================================
-- Lobar Parda — 0002: shaxsiy kod bilan kirish
-- Supabase SQL Editor'da 0001 dan keyin bir marta ishga tushiriladi.
-- ============================================================

-- Kod uzunligi: Admin 8+, Direktor 6+, Tikuvchi va Usta 4+ (faqat raqamlar)
create or replace function public.code_min_length(p_role text) returns int
language sql immutable as $$
  select case p_role when 'admin' then 8 when 'direktor' then 6 else 4 end
$$;

create or replace function public.assert_valid_code(p_role text, p_code text) returns void
language plpgsql immutable as $$
begin
  if p_code is null or p_code !~ '^[0-9]+$' then
    raise exception 'Kod faqat raqamlardan iborat bo''lishi kerak';
  end if;
  if length(p_code) < public.code_min_length(p_role) or length(p_code) > 16 then
    raise exception 'Kod uzunligi % dan 16 tagacha raqam bo''lishi kerak', public.code_min_length(p_role);
  end if;
end $$;

-- Yangi xodim: faqat o'zidan past rolni ochish mumkin (can_manage_role)
create or replace function public.create_staff(p_login text, p_full_name text, p_role text, p_code text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.can_manage_role(p_role) then
    raise exception 'Bu rolda xodim qo''shishga ruxsatingiz yo''q';
  end if;
  perform public.assert_valid_code(p_role, p_code);
  insert into public.staff (login, full_name, role_id)
    values (lower(trim(p_login)), trim(p_full_name), p_role)
    returning id into v_id;
  insert into public.staff_secrets (staff_id, code_hash, auth_secret)
    values (v_id, extensions.crypt(p_code, extensions.gen_salt('bf')),
            encode(extensions.gen_random_bytes(32), 'hex'));
  return v_id;
end $$;

-- Kodni almashtirish: o'zi yoki uni boshqara oladigan rahbar
create or replace function public.set_staff_code(p_staff uuid, p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
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

-- Birinchi Admin: faqat tizimda hali Admin bo'lmasa ishlaydi (SQL Editor'dan bir marta)
create or replace function public.bootstrap_admin(p_login text, p_full_name text, p_code text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if exists (select 1 from public.staff where role_id = 'admin' and deleted_at is null) then
    raise exception 'Admin allaqachon mavjud';
  end if;
  perform public.assert_valid_code('admin', p_code);
  insert into public.staff (login, full_name, role_id)
    values (lower(trim(p_login)), trim(p_full_name), 'admin') returning id into v_id;
  insert into public.staff_secrets (staff_id, code_hash, auth_secret)
    values (v_id, extensions.crypt(p_code, extensions.gen_salt('bf')),
            encode(extensions.gen_random_bytes(32), 'hex'));
  return v_id;
end $$;

-- Login + kodni tekshirish va bloklash (faqat server funksiyasi chaqiradi)
create or replace function public.staff_check_code(p_login text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.staff%rowtype;
  v_hash text; v_secret text;
  v_max int := coalesce((select (value)::text::int from public.app_settings where key = 'login_max_attempts'), 5);
  v_lock int := coalesce((select (value)::text::int from public.app_settings where key = 'login_lock_minutes'), 15);
begin
  select * into s from public.staff where login = lower(trim(p_login)) and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if not s.is_active then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', s.locked_until);
  end if;
  select code_hash, auth_secret into v_hash, v_secret from public.staff_secrets where staff_id = s.id;
  if v_hash is null or extensions.crypt(coalesce(p_code, ''), v_hash) <> v_hash then
    if s.failed_attempts + 1 >= v_max then
      update public.staff set failed_attempts = 0, locked_until = now() + make_interval(mins => v_lock) where id = s.id;
      insert into public.audit_log (staff_id, table_name, row_id, action) values (s.id, 'staff', s.id::text, 'LOGIN_LOCKED');
      return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + make_interval(mins => v_lock));
    end if;
    update public.staff set failed_attempts = s.failed_attempts + 1 where id = s.id;
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'remaining', v_max - s.failed_attempts - 1);
  end if;
  update public.staff set failed_attempts = 0, locked_until = null where id = s.id;
  insert into public.audit_log (staff_id, table_name, row_id, action) values (s.id, 'staff', s.id::text, 'LOGIN');
  return jsonb_build_object('ok', true, 'staff_id', s.id, 'auth_user_id', s.auth_user_id,
                            'email', s.id::text || '@staff.lobarparda.uz', 'secret', v_secret);
end $$;

create or replace function public.staff_link_auth(p_staff uuid, p_auth_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.staff set auth_user_id = p_auth_user where id = p_staff
$$;

-- Kirgan xodimning o'zi haqidagi ma'lumot va ruxsatlari (ilova shuni o'qiydi)
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else jsonb_build_object(
    'staff_id', s.id, 'login', s.login, 'full_name', s.full_name,
    'role', s.role_id, 'role_name', r.name, 'level', r.level,
    'perms', coalesce((
      select jsonb_object_agg(p.action, jsonb_build_object(
               'allowed', case when r.level >= 100 then true else coalesce(o.allowed, p.allowed) end,
               'limit', coalesce(o.limit_value, p.limit_value)))
      from public.permissions p
      left join public.staff_overrides o on o.staff_id = s.id and o.action = p.action
      where p.role_id = case when r.level >= 100 then 'direktor' else s.role_id end), '{}'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from public.app_settings), '{}'::jsonb))
  end
  from (select 1) one
  left join public.staff s on s.auth_user_id = auth.uid() and s.is_active and s.deleted_at is null
  left join public.roles r on r.id = s.role_id
$$;

-- Huquqlar: Supabase'da funksiyalar standart holda hammaga ochiq, shuning uchun aniq cheklaymiz
revoke execute on function public.create_staff(text, text, text, text)  from public, anon;
revoke execute on function public.set_staff_code(uuid, text)            from public, anon;
revoke execute on function public.bootstrap_admin(text, text, text)     from public, anon, authenticated;
revoke execute on function public.staff_check_code(text, text)          from public, anon, authenticated;
revoke execute on function public.staff_link_auth(uuid, uuid)           from public, anon, authenticated;
revoke execute on function public.my_access()                           from public, anon;
grant execute on function public.create_staff(text, text, text, text)  to authenticated;
grant execute on function public.set_staff_code(uuid, text)            to authenticated;
grant execute on function public.my_access()                           to authenticated;
grant execute on function public.staff_check_code(text, text)          to service_role;
grant execute on function public.staff_link_auth(uuid, uuid)           to service_role;
grant execute on function public.bootstrap_admin(text, text, text)     to service_role;

-- Avtomatik qulflash vaqti 1..10 daqiqa oralig'ida bo'lishi shart
create or replace function public.tg_settings_check() returns trigger
language plpgsql as $$
begin
  if new.key = 'auto_lock_minutes' and ((new.value)::text::int < 1 or (new.value)::text::int > 10) then
    raise exception 'Avtomatik qulflash 1 dan 10 daqiqagacha bo''lishi kerak';
  end if;
  return new;
end $$;
create trigger settings_check before insert or update on public.app_settings
  for each row execute function public.tg_settings_check();

-- Direktor xodimlar ro'yxatida faqat o'zini va o'zidan past rollarni (tikuvchi, usta) ko'radi
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated
  using (
    id = public.current_staff_id()
    or public.is_admin()
    or ((select level from public.roles where id = role_id) < public.current_level()
        and (public.has_perm('staff.manage_workers') or public.has_perm('orders.assign')))
  );
