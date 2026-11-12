-- ============================================================
-- Lobar Parda — 0008: xarajatlar va sof foyda
--  * Xarajat turlari: tayyor 5 ta + Admin/Direktor o'zi qo'shadi.
--  * Xarajat ixtiyoriy ravishda buyurtmaga bog'lanadi (masalan, shu mijoz uchun olingan mato).
--  * Sof foyda (kassa bo'yicha) = davrda mijozlardan olingan to'lovlar
--                               − davrdagi xarajatlar − davrda hisoblangan ish haqi.
--  * Buyurtma foydasi = buyurtma summasi − unga bog'langan xarajatlar − shu buyurtma uchun ish haqi.
--  * Kiritish: "expenses.manage" ruxsati (Direktorda standart yoqilgan); ko'rish: shu yoki "reports.view".
-- ============================================================

create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 40),
  sort_order int not null default 100,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists expense_categories_name on public.expense_categories (lower(trim(name))) where deleted_at is null;

insert into public.expense_categories (name, sort_order, is_default)
select v.name, v.ord, true from (values
  ('Mato va mahsulot xaridi', 1), ('Ijara', 2), ('Transport', 3), ('Kommunal', 4), ('Boshqa', 99)
) as v(name, ord)
where not exists (select 1 from public.expense_categories c where lower(c.name) = lower(v.name) and c.deleted_at is null);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id),
  amount      numeric(14,2) not null check (amount > 0),
  spent_on    date not null default current_date,
  note        text check (char_length(note) <= 200),
  order_id    uuid references public.orders(id) on delete set null,
  created_by  uuid default public.current_staff_id() references public.staff(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists expenses_spent on public.expenses (spent_on) where deleted_at is null;
create index if not exists expenses_order on public.expenses (order_id) where deleted_at is null;

insert into public.permissions (role_id, action, allowed, limit_value) values
  ('direktor', 'expenses.manage', true, null), ('tikuvchi', 'expenses.manage', false, null), ('usta', 'expenses.manage', false, null)
on conflict do nothing;

grant select, insert, update on public.expense_categories, public.expenses to authenticated;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy expcat_read on public.expense_categories for select to authenticated
  using (public.has_perm('expenses.manage') or public.has_perm('reports.view'));
create policy expcat_ins on public.expense_categories for insert to authenticated
  with check (public.has_perm('expenses.manage') and not is_default);
create policy expcat_upd on public.expense_categories for update to authenticated
  using (public.has_perm('expenses.manage') and not is_default) with check (public.has_perm('expenses.manage') and not is_default);

create policy expenses_read on public.expenses for select to authenticated
  using (public.has_perm('expenses.manage') or public.has_perm('reports.view'));
create policy expenses_ins on public.expenses for insert to authenticated
  with check (public.has_perm('expenses.manage') and deleted_at is null);
-- O'chirish: faqat deleted_at qo'yiladi (summa va sana o'zgarmaydi — trigger tekshiradi)
create policy expenses_upd on public.expenses for update to authenticated
  using (public.has_perm('expenses.manage')) with check (public.has_perm('expenses.manage'));

create or replace function public.tg_expense_guard() returns trigger
language plpgsql as $$
begin
  if new.amount is distinct from old.amount or new.spent_on is distinct from old.spent_on
     or new.category_id is distinct from old.category_id or new.created_by is distinct from old.created_by
     or new.order_id is distinct from old.order_id or new.note is distinct from old.note
     or old.deleted_at is not null then
    raise exception 'Xarajatni o''zgartirib bo''lmaydi — o''chirib, qaytadan kiriting';
  end if;
  return new;
end $$;
drop trigger if exists expense_guard on public.expenses;
create trigger expense_guard before update on public.expenses
  for each row execute function public.tg_expense_guard();

do $$ begin
  execute 'create trigger audit after insert or update or delete on public.expenses for each row execute function public.tg_audit()';
exception when duplicate_object then null; end $$;

-- ---- Sof foyda (kassa bo'yicha) ----
create or replace function public.profit_report(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_income numeric; v_exp numeric; v_pay numeric; v_cats jsonb;
begin
  if not public.has_perm('reports.view') then raise exception 'Ruxsat yo''q'; end if;
  select coalesce(sum(p.amount), 0) into v_income
    from public.payments p join public.orders o on o.id = p.order_id
   where p.cancelled_at is null and p.deleted_at is null and o.deleted_at is null
     and p.paid_at >= p_from and p.paid_at < p_to;
  select coalesce(sum(e.amount), 0) into v_exp from public.expenses e
   where e.deleted_at is null and e.spent_on >= (p_from at time zone 'Asia/Tashkent')::date and e.spent_on < (p_to at time zone 'Asia/Tashkent')::date;
  select coalesce(sum(w.amount), 0) into v_pay
    from public.worker_earnings w join public.orders o on o.id = w.order_id
   where o.deleted_at is null and w.earned_at >= p_from and w.earned_at < p_to;
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'amount', s.total) order by s.total desc), '[]'::jsonb) into v_cats
    from (select e.category_id, sum(e.amount) total from public.expenses e
           where e.deleted_at is null and e.spent_on >= (p_from at time zone 'Asia/Tashkent')::date and e.spent_on < (p_to at time zone 'Asia/Tashkent')::date
           group by e.category_id) s join public.expense_categories c on c.id = s.category_id;
  return jsonb_build_object('income', v_income, 'expenses', v_exp, 'payroll', v_pay,
                            'profit', v_income - v_exp - v_pay, 'categories', v_cats);
end $$;

-- ---- Bitta buyurtma foydasi ----
create or replace function public.order_profit(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_total numeric; v_exp numeric; v_pay numeric;
begin
  if not public.has_perm('reports.view') then raise exception 'Ruxsat yo''q'; end if;
  select total into v_total from public.orders where id = p_order and deleted_at is null;
  if v_total is null then return null; end if;
  select coalesce(sum(amount), 0) into v_exp from public.expenses where order_id = p_order and deleted_at is null;
  select coalesce(sum(amount), 0) into v_pay from public.worker_earnings where order_id = p_order;
  return jsonb_build_object('total', v_total, 'expenses', v_exp, 'payroll', v_pay, 'profit', v_total - v_exp - v_pay);
end $$;

revoke execute on function public.profit_report(timestamptz, timestamptz) from public, anon;
revoke execute on function public.order_profit(uuid) from public, anon;
grant execute on function public.profit_report(timestamptz, timestamptz) to authenticated;
grant execute on function public.order_profit(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.expenses, public.expense_categories;
exception when duplicate_object then null; end $$;
