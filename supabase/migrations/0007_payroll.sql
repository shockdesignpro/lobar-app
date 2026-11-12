-- ============================================================
-- Lobar Parda — 0007: ishchilar ish haqi (ishbay)
--  * Katalogdagi har bir tikish va o'rnatish xizmatiga "ishchi stavkasi" (1 birlik uchun, masalan 1 m).
--  * Ish haqi bosqich belgilanganda hisobga tushadi:
--      tikish   — "Dazmolandi" (tikishning oxirgi bosqichi) belgilanganda,
--      o'rnatish — "Pardani o'rnatish" belgilanganda.
--    Summa = buyurtmadagi xizmat miqdori × stavka. Bir ishga bir necha kishi biriktirilgan bo'lsa, teng bo'linadi.
--    Stavka ish bajarilgan paytda buyurtma qatoriga muhrlanadi (order_items.worker_rate):
--    keyin katalogdagi stavka o'zgarsa, bajarilgan ishlarning summasi o'zgarmaydi.
--  * Berilgan pullar (avans, oylik) alohida yoziladi; qoldiq = jami hisoblangan − jami berilgan.
--  * Admin va Direktor ("payroll.manage" ruxsati) hammanikini ko'radi va pul beradi,
--    tikuvchi va usta faqat o'zinikini ko'radi.
-- ============================================================

alter table public.products add column if not exists worker_rate numeric(14,2) not null default 0 check (worker_rate >= 0);
-- NULL — hali muhrlanmagan (ish bajarilmagan), son — ish bajarilgan paytdagi stavka
alter table public.order_items add column if not exists worker_rate numeric(14,2) check (worker_rate >= 0);

create table if not exists public.worker_earnings (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  staff_id   uuid not null references public.staff(id),
  task       text not null check (task in ('tikish','ornatish')),
  quantity   numeric(14,3) not null default 0,
  amount     numeric(14,2) not null default 0,
  earned_at  timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists worker_earnings_staff on public.worker_earnings (staff_id, earned_at);
create index if not exists worker_earnings_order on public.worker_earnings (order_id, task);

create table if not exists public.worker_payouts (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id),
  amount       numeric(14,2) not null check (amount > 0),
  paid_at      timestamptz not null default now(),
  note         text check (char_length(note) <= 200),
  created_by   uuid default public.current_staff_id() references public.staff(id),
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists worker_payouts_staff on public.worker_payouts (staff_id, paid_at);

-- Ruxsat: Direktorga standart holatda beriladi, ishchilarga yo'q
insert into public.permissions (role_id, action, allowed, limit_value) values
  ('direktor', 'payroll.manage', true, null), ('tikuvchi', 'payroll.manage', false, null), ('usta', 'payroll.manage', false, null)
on conflict do nothing;

grant select on public.worker_earnings to authenticated;
grant select, insert, update on public.worker_payouts to authenticated;
alter table public.worker_earnings enable row level security;
alter table public.worker_payouts  enable row level security;
create policy earnings_read on public.worker_earnings for select to authenticated
  using (public.has_perm('payroll.manage') or staff_id = public.current_staff_id());
create policy payouts_read on public.worker_payouts for select to authenticated
  using (public.has_perm('payroll.manage') or staff_id = public.current_staff_id());
create policy payouts_ins on public.worker_payouts for insert to authenticated
  with check (public.has_perm('payroll.manage') and staff_id <> public.current_staff_id() and cancelled_at is null);
-- Bekor qilish: faqat cancelled_at qo'yiladi (summa va sana o'zgarmaydi — trigger tekshiradi)
create policy payouts_upd on public.worker_payouts for update to authenticated
  using (public.has_perm('payroll.manage')) with check (public.has_perm('payroll.manage'));

create or replace function public.tg_payout_guard() returns trigger
language plpgsql as $$
begin
  if new.amount is distinct from old.amount or new.staff_id is distinct from old.staff_id
     or new.paid_at is distinct from old.paid_at or new.created_by is distinct from old.created_by
     or (old.cancelled_at is not null) then
    raise exception 'Berilgan pulni faqat bekor qilish mumkin';
  end if;
  return new;
end $$;
drop trigger if exists payout_guard on public.worker_payouts;
create trigger payout_guard before update on public.worker_payouts
  for each row execute function public.tg_payout_guard();

-- O'zgarishlar tarixiga yoziladi
do $$ begin
  execute 'create trigger audit after insert or update or delete on public.worker_payouts for each row execute function public.tg_audit()';
exception when duplicate_object then null; end $$;

-- ---- Hisoblash ----
create or replace function public.recalc_earnings(p_order uuid, p_task text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_at  timestamptz;
  v_n   int;
  v_sum numeric;
  v_qty numeric;
begin
  delete from public.worker_earnings where order_id = p_order and task = p_task;
  select s.done_at into v_at from public.order_steps s
   where s.order_id = p_order and s.done and s.deleted_at is null
     and s.step_key = case p_task when 'tikish' then 'dazmolandi' else 'parda_ornatish' end;
  if v_at is null then return; end if;
  select count(*) into v_n from public.order_assignees a
   where a.order_id = p_order and a.task = p_task and a.deleted_at is null;
  if v_n = 0 then return; end if;
  -- Ish bajarildi: hali muhrlanmagan qatorlarga hozirgi stavkani muhrlaymiz
  update public.order_items i set worker_rate = coalesce((select p.worker_rate from public.products p where p.id = i.product_id), 0)
   where i.order_id = p_order and i.deleted_at is null and i.worker_rate is null
     and i.section = case p_task when 'tikish' then 'tikish' else 'ustanovka' end;
  select coalesce(sum(i.quantity * coalesce(i.worker_rate, 0)), 0), coalesce(sum(i.quantity), 0) into v_sum, v_qty
    from public.order_items i
   where i.order_id = p_order and i.deleted_at is null
     and i.section = case p_task when 'tikish' then 'tikish' else 'ustanovka' end;
  insert into public.worker_earnings (order_id, staff_id, task, quantity, amount, earned_at)
  select p_order, a.staff_id, p_task, round(v_qty / v_n, 3), round(v_sum / v_n, 2), v_at
    from public.order_assignees a where a.order_id = p_order and a.task = p_task and a.deleted_at is null;
end $$;
revoke execute on function public.recalc_earnings(uuid, text) from public, anon, authenticated;

create or replace function public.tg_earnings_step() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.step_key = 'dazmolandi' then perform public.recalc_earnings(new.order_id, 'tikish');
  elsif new.step_key = 'parda_ornatish' then perform public.recalc_earnings(new.order_id, 'ornatish'); end if;
  return null;
end $$;
drop trigger if exists earnings_step on public.order_steps;
create trigger earnings_step after insert or update on public.order_steps
  for each row execute function public.tg_earnings_step();

create or replace function public.tg_earnings_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_earnings(coalesce(new.order_id, old.order_id), coalesce(new.task, old.task));
  return null;
end $$;
drop trigger if exists earnings_assignee on public.order_assignees;
create trigger earnings_assignee after insert or update or delete on public.order_assignees
  for each row execute function public.tg_earnings_assignee();

-- Buyurtma tahrirlansa (miqdor o'zgarsa) — bir marta, buyurtma bo'yicha qayta hisoblanadi
create or replace function public.tg_earnings_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- recalc_earnings'ning o'z muhrlashi qayta chaqirmasin
  for v_order in select distinct order_id from changed loop
    perform public.recalc_earnings(v_order, 'tikish');
    perform public.recalc_earnings(v_order, 'ornatish');
  end loop;
  return null;
end $$;
drop trigger if exists earnings_items_ins on public.order_items;
drop trigger if exists earnings_items_upd on public.order_items;
create trigger earnings_items_ins after insert on public.order_items
  referencing new table as changed for each statement execute function public.tg_earnings_items();
create trigger earnings_items_upd after update on public.order_items
  referencing new table as changed for each statement execute function public.tg_earnings_items();

-- ---- O'qish uchun ----
-- Bir oy (yoki istalgan davr) bo'yicha: har bir ishchining hisoblangan, berilgan va umumiy qoldig'i
create or replace function public.payroll_summary(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('payroll.manage') then raise exception 'Ruxsat yo''q'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'full_name') from (
      select jsonb_build_object(
        'staff_id', s.id, 'full_name', s.full_name, 'role_id', s.role_id, 'is_active', s.is_active,
        'earned', coalesce((select sum(e.amount) from public.worker_earnings e join public.orders o on o.id = e.order_id
                            where e.staff_id = s.id and o.deleted_at is null and e.earned_at >= p_from and e.earned_at < p_to), 0),
        'paid',   coalesce((select sum(p.amount) from public.worker_payouts p
                            where p.staff_id = s.id and p.cancelled_at is null and p.paid_at >= p_from and p.paid_at < p_to), 0),
        'balance', coalesce((select sum(e.amount) from public.worker_earnings e join public.orders o on o.id = e.order_id
                             where e.staff_id = s.id and o.deleted_at is null), 0)
                 - coalesce((select sum(p.amount) from public.worker_payouts p where p.staff_id = s.id and p.cancelled_at is null), 0)
      ) x
      from public.staff s
      where s.role_id in ('tikuvchi', 'usta') and s.deleted_at is null
    ) t), '[]'::jsonb);
end $$;

-- Bitta ishchi: davrdagi ishlari (mijoz nomi bilan), berilgan pullar va umumiy qoldiq
create or replace function public.payroll_detail(p_staff uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_perm('payroll.manage') or p_staff = public.current_staff_id()) then raise exception 'Ruxsat yo''q'; end if;
  return jsonb_build_object(
    'works', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'order_no', o.order_no, 'client_name', coalesce(c.name, 'Mijoz'), 'task', e.task,
        'quantity', e.quantity, 'amount', e.amount, 'earned_at', e.earned_at) order by e.earned_at desc)
      from public.worker_earnings e join public.orders o on o.id = e.order_id left join public.clients c on c.id = o.client_id
      where e.staff_id = p_staff and o.deleted_at is null and e.earned_at >= p_from and e.earned_at < p_to), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'paid_at', p.paid_at, 'note', p.note) order by p.paid_at desc)
      from public.worker_payouts p where p.staff_id = p_staff and p.cancelled_at is null and p.paid_at >= p_from and p.paid_at < p_to), '[]'::jsonb),
    'balance', coalesce((select sum(e.amount) from public.worker_earnings e join public.orders o on o.id = e.order_id
                         where e.staff_id = p_staff and o.deleted_at is null), 0)
             - coalesce((select sum(p.amount) from public.worker_payouts p where p.staff_id = p_staff and p.cancelled_at is null), 0)
  );
end $$;
revoke execute on function public.payroll_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function public.payroll_detail(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.payroll_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.payroll_detail(uuid, timestamptz, timestamptz) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.worker_earnings, public.worker_payouts;
exception when duplicate_object then null; end $$;

-- Avval belgilangan bosqichlar bo'yicha ham hisoblab qo'yamiz (stavkalar hozircha 0 bo'lsa — summa 0)
do $$ declare r record; begin
  for r in select distinct order_id from public.order_steps where done and step_key in ('dazmolandi', 'parda_ornatish') loop
    perform public.recalc_earnings(r.order_id, 'tikish');
    perform public.recalc_earnings(r.order_id, 'ornatish');
  end loop;
end $$;
