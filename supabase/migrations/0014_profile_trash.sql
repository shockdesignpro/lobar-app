-- ============================================================
-- Lobar Parda — 0014: shaxsiy profil (ism, rasm) va korzinka
-- ============================================================

-- 1. PROFIL -----------------------------------------------------------------
alter table public.staff add column if not exists avatar_path text;   -- Storage: avatars/<staff_id>/<fayl>.jpg

-- Profil rasmlari: ochiq papka (rasm manzili tasodifiy nomli), har kim faqat o'z papkasiga yozadi
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_staff_id()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_staff_id()::text);

-- Ism va rasmni o'zgartirish (har bir xodim faqat o'zinikini). p_avatar: null — o'zgarmaydi, '' — o'chiriladi
create or replace function public.update_my_profile(p_full_name text, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_staff_id();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  if v_me is null then raise exception 'Kirilmagan'; end if;
  if length(v_name) < 2 or length(v_name) > 60 then raise exception 'Ism 2 tadan 60 tagacha harf bo''lishi kerak'; end if;
  if p_avatar is not null and p_avatar <> '' and p_avatar !~ ('^' || v_me::text || '/[A-Za-z0-9_.-]+$') then
    raise exception 'Noto''g''ri rasm manzili';
  end if;
  update public.staff set full_name = v_name,
         avatar_path = case when p_avatar is null then avatar_path when p_avatar = '' then null else p_avatar end
  where id = v_me;
  return jsonb_build_object('full_name', v_name, 'avatar', (select avatar_path from public.staff where id = v_me));
end $$;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;

-- my_access endi rasmni ham qaytaradi
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else jsonb_build_object(
    'staff_id', s.id, 'login', s.login, 'full_name', s.full_name, 'avatar', s.avatar_path,
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

-- 2. KORZINKA: butunlay o'chirish (faqat Admin) -------------------------------
-- Butunlay o'chirilgan buyurtma raqami qayta berilmasin (mijoz chekidagi raqam takrorlanmasin)
create table if not exists public.order_no_floor (
  order_year int primary key,
  last_no    int not null
);
alter table public.order_no_floor enable row level security;

create or replace function public.tg_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.order_no is null then
    perform pg_advisory_xact_lock(hashtext('order_no'));
    new.order_year := coalesce(new.order_year, extract(year from coalesce(new.created_at, now()))::int);
    select greatest(coalesce(max(order_no), 0),
                    coalesce((select last_no from public.order_no_floor f where f.order_year = new.order_year), 0)) + 1
      into new.order_no
      from public.orders where order_year = new.order_year;
  end if;
  if new.created_by is null then new.created_by := public.current_staff_id(); end if;
  return new;
end $$;

create or replace function public.purge_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ord public.orders;
begin
  if not public.is_admin() then raise exception 'Butunlay o''chirish faqat Admin uchun'; end if;
  select * into v_ord from public.orders where id = p_order;
  if v_ord.id is null then return; end if;
  if v_ord.deleted_at is null then raise exception 'Avval buyurtmani korzinkaga yuboring'; end if;
  if exists (select 1 from public.payments where order_id = p_order and cancelled_at is null and deleted_at is null) then
    raise exception 'To''lovi bor buyurtmani butunlay o''chirib bo''lmaydi — u hisobotlarda turadi. Korzinkada qoldiring yoki avval to''lovni bekor qiling.';
  end if;
  if exists (select 1 from public.worker_payouts where order_id = p_order and cancelled_at is null) then
    raise exception 'Bu buyurtma uchun ishchiga pul berilgan — butunlay o''chirib bo''lmaydi.';
  end if;
  if v_ord.order_no is not null then
    insert into public.order_no_floor (order_year, last_no) values (v_ord.order_year, v_ord.order_no)
    on conflict (order_year) do update set last_no = greatest(public.order_no_floor.last_no, excluded.last_no);
  end if;
  delete from public.worker_payouts where order_id = p_order;          -- faqat bekor qilinganlari qolgan
  delete from public.order_items where order_id = p_order;
  delete from public.openings where room_id in (select id from public.rooms where order_id = p_order);
  delete from public.orders where id = p_order;                         -- qolganlari o'zi o'chadi (cascade)
end $$;

create or replace function public.purge_product(p_product uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Butunlay o''chirish faqat Admin uchun'; end if;
  if not exists (select 1 from public.products where id = p_product and deleted_at is not null) then
    raise exception 'Avval mahsulotni korzinkaga yuboring';
  end if;
  -- Eski buyurtmalarda nomi va narxi saqlanib qoladi, faqat katalogga bog'lanish uziladi
  update public.order_items set product_id = null where product_id = p_product;
  update public.macros set product_ids = array_remove(product_ids, p_product) where p_product = any(product_ids);
  delete from public.products where id = p_product;
end $$;

revoke all on function public.purge_order(uuid) from public, anon;
revoke all on function public.purge_product(uuid) from public, anon;
grant execute on function public.purge_order(uuid) to authenticated;
grant execute on function public.purge_product(uuid) to authenticated;
