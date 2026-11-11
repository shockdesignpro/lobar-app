-- ============================================================
-- Lobar Parda — 0001: asosiy sxema, rollar, ruxsatlar va RLS
-- Supabase SQL Editor'da bir marta ishga tushiriladi.
-- Ierarxiya: Admin (100) > Direktor (50) > Tikuvchi / Usta (10)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1. ROLLAR VA XODIMLAR
-- ------------------------------------------------------------
create table public.roles (
  id          text primary key,              -- 'admin' | 'direktor' | 'tikuvchi' | 'usta'
  name        text not null,
  level       int  not null check (level between 1 and 100),
  created_at  timestamptz not null default now()
);

create table public.staff (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users(id) on delete set null,
  login            text not null unique check (login ~ '^[a-z0-9_.-]{2,32}$'),
  full_name        text not null,
  role_id          text not null references public.roles(id),
  is_active        boolean not null default true,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  deleted_at       timestamptz
);

-- Kod xeshi alohida jadvalda: ilova (authenticated) unga umuman kira olmaydi,
-- faqat server funksiyasi (service_role) o'qiydi.
create table public.staff_secrets (
  staff_id    uuid primary key references public.staff(id) on delete cascade,
  code_hash   text not null,                  -- crypt(code, gen_salt('bf'))
  auth_secret text not null,                  -- Supabase Auth uchun tasodifiy uzun parol
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. RUXSATLAR VA SOZLAMALAR
-- ------------------------------------------------------------
create table public.permissions (
  role_id      text not null references public.roles(id) on delete cascade,
  action       text not null,
  allowed      boolean not null default false,
  limit_value  numeric,                       -- masalan, chegirma foizi
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  primary key (role_id, action)
);

create table public.staff_overrides (
  staff_id     uuid not null references public.staff(id) on delete cascade,
  action       text not null,
  allowed      boolean not null,
  limit_value  numeric,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  primary key (staff_id, action)
);

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- ------------------------------------------------------------
-- 3. KATALOG VA MAKROSLAR
-- ------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   int unique,                     -- eski Lobar-katalog.csv dagi ID
  name        text not null,
  section     text not null check (section in ('mahsulot','tikish','ustanovka')),
  price       numeric(14,2) not null default 0 check (price >= 0),
  unit        text not null default 'dona',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz
);

create table public.macros (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('baget','potolok')),
  name         text not null,
  product_ids  uuid[] not null default '{}',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  deleted_at   timestamptz
);

-- ------------------------------------------------------------
-- 4. MIJOZLAR VA BUYURTMALAR
-- ------------------------------------------------------------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz
);

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_year        int,
  order_no          int,                      -- yil ichida 0001 dan; serverda beriladi
  client_id         uuid references public.clients(id),
  ready_date        date,
  total             numeric(14,2) not null default 0,
  discount_percent  numeric(5,2)  not null default 0 check (discount_percent between 0 and 100),
  status            text not null default 'active' check (status in ('draft','active','done','cancelled')),
  notes             text,
  photos            text[] not null default '{}',   -- Storage: order-photos/<order_id>/...
  created_by        uuid references public.staff(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  deleted_at        timestamptz,
  unique (order_year, order_no)
);

create table public.order_assignees (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  staff_id    uuid not null references public.staff(id),
  task        text not null check (task in ('tikish','ornatish')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz,
  unique (order_id, staff_id, task)
);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz
);

create table public.openings (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  kind        text not null default 'deraza' check (kind in ('deraza','eshik')),
  height      text,                           -- bo'yi (eski ilovadagidek matn)
  width       text,                           -- eni
  rail_type   text,                           -- karniz: Truba | Baget | Qosh
  color       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz
);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  room_id      uuid references public.rooms(id) on delete set null,
  opening_id   uuid references public.openings(id) on delete set null,
  section      text not null check (section in ('mahsulot','tikish','ustanovka')),
  product_id   uuid references public.products(id),
  product_name text not null,                 -- o'sha paytdagi nom
  unit         text,
  quantity     numeric(12,3),
  unit_price   numeric(14,2) not null default 0, -- O'SHA PAYTDAGI NARX (snapshot)
  linked_from_width boolean not null default false, -- "eni"dan avtomatik yaratilgan qator
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  deleted_at   timestamptz
);

create table public.order_steps (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  step_key    text not null check (step_key in (
                'razmer','sotib_olindi','tikuvchiga_berildi','bichildi','chetlari_tikildi',
                'boy_chiqarildi','tepasi_tikildi','dazmolandi','karniz_ustanovka','parda_ornatish')),
  done        boolean not null default false,
  done_by     uuid references public.staff(id),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  deleted_at  timestamptz,
  unique (order_id, step_key)
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  paid_at       timestamptz not null default now(),
  created_by    uuid references public.staff(id),
  cancelled_at  timestamptz,
  cancelled_by  uuid references public.staff(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  deleted_at    timestamptz
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  staff_id    uuid,
  table_name  text not null,
  row_id      text,
  action      text not null,                  -- INSERT | UPDATE | DELETE
  old_data    jsonb,
  new_data    jsonb
);

create index on public.orders (ready_date) where deleted_at is null;
create index on public.orders (client_id);
create index on public.order_assignees (staff_id);
create index on public.rooms (order_id);
create index on public.openings (room_id);
create index on public.order_items (order_id);
create index on public.order_steps (order_id);
create index on public.payments (order_id);
create index on public.audit_log (table_name, row_id);
create index on public.audit_log (at desc);

-- ------------------------------------------------------------
-- 5. YORDAMCHI FUNKSIYALAR (kim kirgan, darajasi, ruxsati)
-- ------------------------------------------------------------
create or replace function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff
  where auth_user_id = auth.uid() and is_active and deleted_at is null
$$;

create or replace function public.current_level() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select r.level from public.staff s join public.roles r on r.id = s.role_id
                   where s.auth_user_id = auth.uid() and s.is_active and s.deleted_at is null), 0)
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.current_level() >= 100 $$;

-- Ruxsat: Admin har doim ha; aks holda shaxsiy istisno, keyin rol ruxsati.
create or replace function public.has_perm(p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.current_level() >= 100 then true
    when public.current_staff_id() is null then false
    else coalesce(
      (select o.allowed from public.staff_overrides o
        where o.staff_id = public.current_staff_id() and o.action = p_action),
      (select p.allowed from public.permissions p join public.staff s on s.role_id = p.role_id
        where s.id = public.current_staff_id() and p.action = p_action),
      false)
  end
$$;

create or replace function public.perm_limit(p_action text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.limit_value from public.staff_overrides o
      where o.staff_id = public.current_staff_id() and o.action = p_action),
    (select p.limit_value from public.permissions p join public.staff s on s.role_id = p.role_id
      where s.id = public.current_staff_id() and p.action = p_action))
$$;

create or replace function public.is_assigned(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_assignees a
                 where a.order_id = p_order and a.staff_id = public.current_staff_id()
                   and a.deleted_at is null)
$$;

create or replace function public.can_see_order(p_order uuid) returns boolean
language sql stable as $$
  select public.has_perm('orders.view_all') or public.is_assigned(p_order)
$$;

create or replace function public.step_group(p_key text) returns text
language sql immutable as $$
  select case
    when p_key in ('bichildi','chetlari_tikildi','boy_chiqarildi','tepasi_tikildi','dazmolandi') then 'tikish'
    when p_key in ('karniz_ustanovka','parda_ornatish') then 'ornatish'
    else 'ofis' end
$$;

-- ------------------------------------------------------------
-- 6. TRIGGERLAR: updated_at/updated_by, tarix, qoidalar
-- ------------------------------------------------------------
create or replace function public.tg_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  new.updated_by := coalesce(public.current_staff_id(), new.updated_by);
  return new;
end $$;

create or replace function public.tg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (staff_id, table_name, row_id, action, old_data, new_data)
  values (public.current_staff_id(), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'key'),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['staff','permissions','staff_overrides','app_settings','products','macros',
    'clients','orders','order_assignees','rooms','openings','order_items','order_steps','payments']
  loop
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function public.tg_touch()', t);
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Buyurtma raqami: yil ichida ketma-ket (eski ilovadagidek 0001, 0002 ...)
create or replace function public.tg_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.order_no is null then
    perform pg_advisory_xact_lock(hashtext('order_no'));
    new.order_year := coalesce(new.order_year, extract(year from coalesce(new.created_at, now()))::int);
    select coalesce(max(order_no), 0) + 1 into new.order_no
      from public.orders where order_year = new.order_year;
  end if;
  if new.created_by is null then new.created_by := public.current_staff_id(); end if;
  return new;
end $$;
create trigger order_number before insert on public.orders
  for each row execute function public.tg_order_number();

-- Chegirma chegarasi: Admin cheklovsiz, boshqalar Admin belgilagan foizgacha
create or replace function public.tg_discount_limit() returns trigger
language plpgsql as $$
begin
  if new.discount_percent > 0 and not public.is_admin()
     and (tg_op = 'INSERT' or new.discount_percent is distinct from old.discount_percent) then
    if not public.has_perm('discount.give')
       or new.discount_percent > coalesce(public.perm_limit('discount.give'), 0) then
      raise exception 'Chegirma chegarasidan oshib ketdi (ruxsat: % foiz)', coalesce(public.perm_limit('discount.give'), 0);
    end if;
  end if;
  return new;
end $$;
create trigger discount_limit before insert or update on public.orders
  for each row execute function public.tg_discount_limit();

-- To'lov: qarzdan oshmasin; bekor qilish faqat ruxsat bilan; summa o'zgarmaydi
create or replace function public.tg_payment_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_paid numeric;
begin
  if tg_op = 'INSERT' then
    select o.total * (1 - o.discount_percent / 100) into v_total from public.orders o where o.id = new.order_id;
    select coalesce(sum(amount), 0) into v_paid from public.payments
      where order_id = new.order_id and cancelled_at is null and deleted_at is null and id <> new.id;
    if v_paid + new.amount > v_total + 0.01 then
      raise exception 'To''lov qolgan qarzdan oshib ketdi';
    end if;
    new.created_by := coalesce(new.created_by, public.current_staff_id());
  else
    if new.amount <> old.amount or new.order_id <> old.order_id then
      raise exception 'To''lov summasini o''zgartirib bo''lmaydi, uni bekor qiling';
    end if;
    if new.cancelled_at is not null and old.cancelled_at is null then
      if not public.has_perm('payments.cancel') then
        raise exception 'To''lovni bekor qilishga ruxsat yo''q';
      end if;
      new.cancelled_by := public.current_staff_id();
    end if;
  end if;
  return new;
end $$;
create trigger payment_rules before insert or update on public.payments
  for each row execute function public.tg_payment_rules();

-- Ish bosqichi: tikuvchi faqat tikish, usta faqat o'rnatish bosqichlarini belgilaydi
create or replace function public.can_mark_step(p_order uuid, p_key text) returns boolean
language sql stable as $$
  select public.has_perm('steps.all')
      or (public.step_group(p_key) = 'tikish'   and public.has_perm('steps.tikish')   and public.is_assigned(p_order))
      or (public.step_group(p_key) = 'ornatish' and public.has_perm('steps.ornatish') and public.is_assigned(p_order))
$$;

create or replace function public.tg_step_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_by := public.current_staff_id(); new.done_at := now();
  elsif not new.done then
    new.done_by := null; new.done_at := null;
  end if;
  return new;
end $$;
create trigger step_done before insert or update on public.order_steps
  for each row execute function public.tg_step_done();

-- Xodimlar ierarxiyasi: o'zidan past darajani boshqaradi; oxirgi Admin himoyalangan
create or replace function public.can_manage_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then true
    when (select level from public.roles where id = p_role) >= public.current_level() then false
    when (select level from public.roles where id = p_role) >= 50 then public.has_perm('staff.manage_directors')
    else public.has_perm('staff.manage_workers')
  end
$$;

create or replace function public.tg_staff_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.id = public.current_staff_id() and not public.is_admin()
     and (new.role_id <> old.role_id or new.is_active <> old.is_active) then
    raise exception 'O''zingizning rolingiz yoki holatingizni o''zgartira olmaysiz';
  end if;
  if tg_op in ('UPDATE','DELETE') and old.role_id = 'admin'
     and (tg_op = 'DELETE' or new.role_id <> 'admin' or not new.is_active or new.deleted_at is not null)
     and (select count(*) from public.staff
           where role_id = 'admin' and is_active and deleted_at is null and id <> old.id) = 0 then
    raise exception 'Tizimda kamida bitta faol Admin qolishi shart';
  end if;
  return coalesce(new, old);
end $$;
create trigger staff_rules before update or delete on public.staff
  for each row execute function public.tg_staff_rules();

-- ------------------------------------------------------------
-- 7. ISHCHILAR UCHUN NARXSIZ KO'RINISHLAR
-- ------------------------------------------------------------
create or replace view public.work_orders with (security_barrier) as
  select o.id, o.order_year, o.order_no, o.ready_date, o.status, o.notes, o.photos,
         c.name as client_name,
         case when public.has_perm('clients.contact_view') then c.phone   end as client_phone,
         case when public.has_perm('clients.contact_view') then c.address end as client_address,
         o.updated_at
  from public.orders o left join public.clients c on c.id = o.client_id
  where o.deleted_at is null and public.can_see_order(o.id);

create or replace view public.work_items with (security_barrier) as
  select i.id, i.order_id, i.room_id, i.opening_id, i.section, i.product_name, i.unit, i.quantity, i.updated_at
  from public.order_items i
  where i.deleted_at is null and public.can_see_order(i.order_id);

-- ------------------------------------------------------------
-- 8. RLS QOIDALARI
-- ------------------------------------------------------------
alter table public.roles           enable row level security;
alter table public.staff           enable row level security;
alter table public.staff_secrets   enable row level security;  -- siyosat yo'q = hech kimga ochiq emas
alter table public.permissions     enable row level security;
alter table public.staff_overrides enable row level security;
alter table public.app_settings    enable row level security;
alter table public.products        enable row level security;
alter table public.macros          enable row level security;
alter table public.clients         enable row level security;
alter table public.orders          enable row level security;
alter table public.order_assignees enable row level security;
alter table public.rooms           enable row level security;
alter table public.openings        enable row level security;
alter table public.order_items     enable row level security;
alter table public.order_steps     enable row level security;
alter table public.payments        enable row level security;
alter table public.audit_log       enable row level security;

-- Rollar: hamma kirgan xodim ko'radi, faqat Admin o'zgartiradi
create policy roles_read  on public.roles for select to authenticated using (public.current_staff_id() is not null);
create policy roles_write on public.roles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Xodimlar
create policy staff_read on public.staff for select to authenticated
  using (id = public.current_staff_id() or public.has_perm('staff.manage_workers') or public.is_admin()
         or (public.has_perm('orders.assign') ));
create policy staff_insert on public.staff for insert to authenticated
  with check (public.can_manage_role(role_id));
create policy staff_update on public.staff for update to authenticated
  using (public.can_manage_role(role_id) or id = public.current_staff_id())
  with check (public.can_manage_role(role_id) or (id = public.current_staff_id()));
create policy staff_delete on public.staff for delete to authenticated using (public.is_admin());

-- Ruxsatlar: o'z rolini hamma ko'radi, o'zgartirish faqat Admin
create policy perm_read  on public.permissions for select to authenticated
  using (public.is_admin() or role_id = (select role_id from public.staff where id = public.current_staff_id()));
create policy perm_write on public.permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ovr_read  on public.staff_overrides for select to authenticated
  using (public.is_admin() or staff_id = public.current_staff_id());
create policy ovr_write on public.staff_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sozlamalar
create policy settings_read  on public.app_settings for select to authenticated using (public.current_staff_id() is not null);
create policy settings_write on public.app_settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Katalog va makroslar (narx bor, shuning uchun prices.view kerak)
create policy products_read  on public.products for select to authenticated using (public.has_perm('prices.view'));
create policy products_ins   on public.products for insert to authenticated with check (public.has_perm('catalog.edit'));
create policy products_upd   on public.products for update to authenticated using (public.has_perm('catalog.edit')) with check (public.has_perm('catalog.edit'));
create policy macros_read    on public.macros for select to authenticated using (public.has_perm('orders.edit'));
create policy macros_ins     on public.macros for insert to authenticated with check (public.has_perm('catalog.edit'));
create policy macros_upd     on public.macros for update to authenticated using (public.has_perm('catalog.edit')) with check (public.has_perm('catalog.edit'));

-- Mijozlar va buyurtmalar (to'liq jadval faqat orders.view_all uchun; ishchilar work_* ko'rinishidan foydalanadi)
create policy clients_read on public.clients for select to authenticated using (public.has_perm('orders.view_all'));
create policy clients_ins  on public.clients for insert to authenticated with check (public.has_perm('orders.edit'));
create policy clients_upd  on public.clients for update to authenticated using (public.has_perm('orders.edit')) with check (public.has_perm('orders.edit'));

create policy orders_read on public.orders for select to authenticated using (public.has_perm('orders.view_all'));
create policy orders_ins  on public.orders for insert to authenticated with check (public.has_perm('orders.edit'));
create policy orders_upd  on public.orders for update to authenticated
  using (public.has_perm('orders.edit'))
  with check (public.has_perm('orders.edit') and (deleted_at is null or public.has_perm('archive.send')));

create policy assignees_read on public.order_assignees for select to authenticated
  using (public.has_perm('orders.view_all') or staff_id = public.current_staff_id());
create policy assignees_write on public.order_assignees for insert to authenticated with check (public.has_perm('orders.assign'));
create policy assignees_upd   on public.order_assignees for update to authenticated using (public.has_perm('orders.assign')) with check (public.has_perm('orders.assign'));

create policy rooms_read on public.rooms for select to authenticated using (public.can_see_order(order_id));
create policy rooms_ins  on public.rooms for insert to authenticated with check (public.has_perm('orders.edit'));
create policy rooms_upd  on public.rooms for update to authenticated using (public.has_perm('orders.edit')) with check (public.has_perm('orders.edit'));

create policy openings_read on public.openings for select to authenticated
  using (public.can_see_order((select order_id from public.rooms r where r.id = room_id)));
create policy openings_ins on public.openings for insert to authenticated with check (public.has_perm('orders.edit'));
create policy openings_upd on public.openings for update to authenticated using (public.has_perm('orders.edit')) with check (public.has_perm('orders.edit'));

create policy items_read on public.order_items for select to authenticated using (public.has_perm('prices.view') and public.can_see_order(order_id));
create policy items_ins  on public.order_items for insert to authenticated with check (public.has_perm('orders.edit'));
create policy items_upd  on public.order_items for update to authenticated using (public.has_perm('orders.edit')) with check (public.has_perm('orders.edit'));

create policy steps_read on public.order_steps for select to authenticated using (public.can_see_order(order_id));
create policy steps_ins  on public.order_steps for insert to authenticated with check (public.can_mark_step(order_id, step_key));
create policy steps_upd  on public.order_steps for update to authenticated
  using (public.can_mark_step(order_id, step_key)) with check (public.can_mark_step(order_id, step_key));

create policy payments_read on public.payments for select to authenticated using (public.has_perm('payments.view'));
create policy payments_ins  on public.payments for insert to authenticated with check (public.has_perm('payments.add'));
create policy payments_upd  on public.payments for update to authenticated
  using (public.has_perm('payments.add') or public.has_perm('payments.cancel'))
  with check (public.has_perm('payments.add') or public.has_perm('payments.cancel'));

create policy audit_read on public.audit_log for select to authenticated
  using (public.is_admin() or (public.has_perm('audit.view') and staff_id in
         (select s.id from public.staff s join public.roles r on r.id = s.role_id where r.level < public.current_level())
         or staff_id = public.current_staff_id()));

-- Butunlay o'chirish (DELETE) faqat Admin: qolganlar deleted_at qo'yib arxivlaydi
do $$
declare t text;
begin
  foreach t in array array['products','macros','clients','orders','order_assignees','rooms','openings',
                           'order_items','order_steps','payments']
  loop
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())',
                   t || '_delete', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 9. HUQUQLAR (yangi jadvallar avtomatik ochilmaydi, shuning uchun aniq beriladi)
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.roles, public.staff, public.permissions, public.staff_overrides, public.app_settings,
  public.products, public.macros, public.clients, public.orders, public.order_assignees,
  public.rooms, public.openings, public.order_items, public.order_steps, public.payments
  to authenticated;
grant select on public.audit_log, public.work_orders, public.work_items to authenticated;
revoke all on public.staff_secrets from anon, authenticated;
grant all on public.staff_secrets to service_role;
grant all on all tables in schema public to service_role;

-- ------------------------------------------------------------
-- 10. REALTIME (hamma qurilmaga darhol yetkazish)
-- ------------------------------------------------------------
alter publication supabase_realtime add table
  public.permissions, public.staff_overrides, public.app_settings, public.products, public.macros,
  public.clients, public.orders, public.order_assignees, public.rooms, public.openings,
  public.order_items, public.order_steps, public.payments, public.staff;

-- ------------------------------------------------------------
-- 11. BOSHLANG'ICH MA'LUMOTLAR
-- ------------------------------------------------------------
insert into public.roles (id, name, level) values
  ('admin','Admin',100), ('direktor','Direktor',50), ('tikuvchi','Tikuvchi',10), ('usta','Usta',10);

-- Ruxsatlar jadvali (texnik topshiriqdagi boshlang'ich holat). Admin har doim hammasiga ega.
insert into public.permissions (role_id, action, allowed, limit_value)
select r.role_id, a.action, r.allowed, a.limit_value from (values
  -- action                    direktor tikuvchi usta  limit
  ('orders.view_all',          true,   false,  false, null::numeric),
  ('orders.edit',              true,   false,  false, null),
  ('orders.assign',            true,   false,  false, null),
  ('clients.contact_view',     true,   true,   true,  null),
  ('prices.view',              true,   false,  false, null),
  ('payments.view',            true,   false,  false, null),
  ('payments.add',             true,   false,  false, null),
  ('payments.cancel',          false,  false,  false, null),
  ('catalog.edit',             true,   false,  false, null),
  ('discount.give',            true,   false,  false, 5),
  ('reports.view',             true,   false,  false, null),
  ('steps.all',                true,   false,  false, null),
  ('steps.tikish',             false,  true,   false, null),
  ('steps.ornatish',           false,  false,  true,  null),
  ('staff.manage_workers',     true,   false,  false, null),
  ('staff.manage_directors',   false,  false,  false, null),
  ('archive.send',             true,   false,  false, null),
  ('audit.view',               true,   false,  false, null)
) as a(action, direktor, tikuvchi, usta, limit_value)
cross join lateral (values ('direktor', a.direktor), ('tikuvchi', a.tikuvchi), ('usta', a.usta)) as r(role_id, allowed);

insert into public.app_settings (key, value) values
  ('auto_lock_minutes', '5'::jsonb),          -- Admin 1..10 oralig'ida sozlaydi
  ('reminder_time',     '"10:00"'::jsonb),
  ('login_max_attempts','5'::jsonb),
  ('login_lock_minutes','15'::jsonb);

-- Katalog: eski Lobar-katalog.csv (31 ta mahsulot)
insert into public.products (legacy_id, name, section, price, unit, sort_order) values
  (1,'Baget','mahsulot',35000,'m',1),
  (2,'Bir balo','mahsulot',250,'dona',2),
  (3,'Bubon','mahsulot',50000,'dona',3),
  (4,'Derjalka','mahsulot',50000,'dona',4),
  (5,'Kadefe','mahsulot',30000,'m',5),
  (6,'Karniz','mahsulot',50000,'dona',6),
  (7,'Karniz 1 (tikish)','tikish',60000,'m',7),
  (8,'Karniz 2 (tikish)','tikish',60000,'m',8),
  (9,'Karniz 3 (tikish)','tikish',60000,'m',9),
  (10,'Karniz 4 (tikish)','tikish',60000,'m',10),
  (11,'Karsaj','mahsulot',25000,'m',11),
  (12,'Kolechka','mahsulot',1500,'dona',12),
  (13,'Kolso','mahsulot',1000,'dona',13),
  (14,'Konfet bubi','mahsulot',100000,'dona',14),
  (15,'Korset','mahsulot',4000,'m',15),
  (16,'Kupala','mahsulot',5000,'m',16),
  (17,'Kvars','mahsulot',55000,'m',17),
  (18,'Latta','mahsulot',3250,'m',18),
  (19,'Magnit','mahsulot',25000,'juft',19),
  (20,'Material','mahsulot',40000,'m',20),
  (21,'Nojka','mahsulot',15000,'dona',21),
  (22,'Obxvat','mahsulot',85000,'dona',22),
  (23,'Perdekit','mahsulot',5500,'dona',23),
  (24,'Tesma','mahsulot',5000,'m',24),
  (25,'Truba karniz','mahsulot',18000,'m',25),
  (26,'Ust. Karniz 1','ustanovka',50000,'m',26),
  (27,'Ust. Karniz 2','ustanovka',50000,'m',27),
  (28,'Ust. Karniz 3','ustanovka',50000,'m',28),
  (29,'Ust. Karniz 4','ustanovka',50000,'m',29),
  (30,'Xalqa','mahsulot',1000,'dona',30),
  (31,'Zashitnik','mahsulot',35000,'m',31);

-- ------------------------------------------------------------
-- 12. RASMLAR UCHUN STORAGE
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('order-photos', 'order-photos', false)
  on conflict (id) do nothing;

create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'order-photos' and public.can_see_order(((storage.foldername(name))[1])::uuid));
create policy photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'order-photos' and public.has_perm('orders.edit'));
