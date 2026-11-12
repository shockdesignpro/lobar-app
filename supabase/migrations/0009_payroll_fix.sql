-- ============================================================
-- Lobar Parda — 0009: ish haqi hisobini tuzatish
--  1) Stavka 0 (hali kiritilmagan) bo'lgan paytda bajarilgan ishlar 0 bilan "muhrlanib" qolardi.
--     Endi 0 — "muhrlanmagan" hisoblanadi: katalogda stavka kiritilishi bilan shu ishlar
--     avtomatik qayta hisoblanadi. Haqiqiy (0 dan katta) stavka avvalgidek muhrlanadi.
--  2) Buyurtmaga hech kim biriktirilmagan bo'lsa, bosqichni belgilagan tikuvchi (yoki usta)
--     o'zi ish egasi hisoblanadi.
--  3) Barcha bajarilgan ishlar qayta hisoblanadi.
--  4) Hisobotda ma'lumot uchun "Ishchilarga berilgan pul" ham ko'rsatiladi (foydadan ayrilmaydi —
--     foydadan hisoblangan ish haqi ayriladi, aks holda bitta pul ikki marta hisoblanadi).
-- ============================================================

create or replace function public.recalc_earnings(p_order uuid, p_task text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_at   timestamptz;
  v_by   uuid;
  v_n    int;
  v_staff uuid[];
  v_sum  numeric;
  v_qty  numeric;
  v_sec  text := case p_task when 'tikish' then 'tikish' else 'ustanovka' end;
  v_role text := case p_task when 'tikish' then 'tikuvchi' else 'usta' end;
begin
  delete from public.worker_earnings where order_id = p_order and task = p_task;
  select s.done_at, s.done_by into v_at, v_by from public.order_steps s
   where s.order_id = p_order and s.done and s.deleted_at is null
     and s.step_key = case p_task when 'tikish' then 'dazmolandi' else 'parda_ornatish' end;
  if v_at is null then return; end if;

  -- Ish egalari: biriktirilganlar; hech kim bo'lmasa — belgilagan tikuvchi/usta
  v_staff := array(select a.staff_id from public.order_assignees a
                    where a.order_id = p_order and a.task = p_task and a.deleted_at is null);
  if cardinality(v_staff) = 0 and v_by is not null and exists (select 1 from public.staff where id = v_by and role_id = v_role) then
    v_staff := array[v_by];
  end if;
  v_n := cardinality(v_staff);
  if v_n = 0 then return; end if;

  -- Hali haqiqiy stavka muhrlanmagan qatorlarga katalogdagi hozirgi stavkani qo'yamiz
  update public.order_items i set worker_rate = coalesce((select p.worker_rate from public.products p where p.id = i.product_id), 0)
   where i.order_id = p_order and i.deleted_at is null and coalesce(i.worker_rate, 0) = 0 and i.section = v_sec;
  select coalesce(sum(i.quantity * coalesce(i.worker_rate, 0)), 0), coalesce(sum(i.quantity), 0) into v_sum, v_qty
    from public.order_items i where i.order_id = p_order and i.deleted_at is null and i.section = v_sec;

  insert into public.worker_earnings (order_id, staff_id, task, quantity, amount, earned_at)
  select p_order, x, p_task, round(v_qty / v_n, 3), round(v_sum / v_n, 2), v_at from unnest(v_staff) as x;
end $$;
revoke execute on function public.recalc_earnings(uuid, text) from public, anon, authenticated;

-- Katalogda stavka o'zgarsa: shu xizmat ishlatilgan, lekin hali stavkasi muhrlanmagan (0) bajarilgan ishlar qayta hisoblanadi
create or replace function public.tg_earnings_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.worker_rate is not distinct from old.worker_rate then return null; end if;
  for r in select distinct i.order_id from public.order_items i
            where i.product_id = new.id and i.deleted_at is null and coalesce(i.worker_rate, 0) = 0 loop
    perform public.recalc_earnings(r.order_id, 'tikish');
    perform public.recalc_earnings(r.order_id, 'ornatish');
  end loop;
  return null;
end $$;
drop trigger if exists earnings_rate on public.products;
create trigger earnings_rate after update of worker_rate on public.products
  for each row execute function public.tg_earnings_rate();

-- Hammasini qayta hisoblaymiz
do $$ declare r record; begin
  for r in select distinct order_id from public.order_steps where done and step_key in ('dazmolandi', 'parda_ornatish') loop
    perform public.recalc_earnings(r.order_id, 'tikish');
    perform public.recalc_earnings(r.order_id, 'ornatish');
  end loop;
end $$;

create or replace function public.profit_report(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_income numeric; v_exp numeric; v_pay numeric; v_paid numeric; v_cats jsonb;
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
  select coalesce(sum(p.amount), 0) into v_paid from public.worker_payouts p
   where p.cancelled_at is null and p.paid_at >= p_from and p.paid_at < p_to;
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'amount', s.total) order by s.total desc), '[]'::jsonb) into v_cats
    from (select e.category_id, sum(e.amount) total from public.expenses e
           where e.deleted_at is null and e.spent_on >= (p_from at time zone 'Asia/Tashkent')::date and e.spent_on < (p_to at time zone 'Asia/Tashkent')::date
           group by e.category_id) s join public.expense_categories c on c.id = s.category_id;
  return jsonb_build_object('income', v_income, 'expenses', v_exp, 'payroll', v_pay, 'paid_out', v_paid,
                            'profit', v_income - v_exp - v_pay, 'categories', v_cats);
end $$;
