-- ============================================================
-- Lobar Parda — 0011: ish haqini aynan bajarilgan ish uchun to'lash
--  * To'lov ma'lum buyurtmadagi ishga (buyurtma + tikish/o'rnatish) bog'lanadi.
--  * Ishning to'lanmagan qismidan ko'p to'lab bo'lmaydi (ikki marta to'lash oldi olinadi).
--  * Bog'lanmagan to'lov (avans) avvalgidek mumkin.
--  * Ro'yxatda har bir ish uchun qancha to'langani ko'rinadi.
-- ============================================================

alter table public.worker_payouts add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.worker_payouts add column if not exists task text check (task in ('tikish', 'ornatish'));
alter table public.worker_payouts drop constraint if exists worker_payouts_job_pair;
alter table public.worker_payouts add constraint worker_payouts_job_pair check ((order_id is null) = (task is null));
create index if not exists worker_payouts_job on public.worker_payouts (staff_id, order_id, task) where cancelled_at is null;

-- Ish uchun to'lov: shu ishchi shu ishni bajargan bo'lishi va summa to'lanmagan qismdan oshmasligi kerak
create or replace function public.tg_payout_job_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_earned numeric; v_paid numeric;
begin
  if new.order_id is null then return new; end if;
  select coalesce(sum(amount), 0) into v_earned from public.worker_earnings
   where staff_id = new.staff_id and order_id = new.order_id and task = new.task;
  if v_earned = 0 then raise exception 'Bu ishchi bu ishni bajarmagan'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.worker_payouts
   where staff_id = new.staff_id and order_id = new.order_id and task = new.task and cancelled_at is null;
  if new.amount > v_earned - v_paid + 0.01 then
    raise exception 'Bu ish uchun to''lanadigan summa qolmagan (to''langan: % so''m)', round(v_paid);
  end if;
  return new;
end $$;
drop trigger if exists payout_job_check on public.worker_payouts;
create trigger payout_job_check before insert on public.worker_payouts
  for each row execute function public.tg_payout_job_check();

-- Bekor qilishdan boshqa o'zgarish taqiqlanadi (ishga bog'lanish ham)
create or replace function public.tg_payout_guard() returns trigger
language plpgsql as $$
begin
  if new.amount is distinct from old.amount or new.staff_id is distinct from old.staff_id
     or new.paid_at is distinct from old.paid_at or new.created_by is distinct from old.created_by
     or new.order_id is distinct from old.order_id or new.task is distinct from old.task
     or (old.cancelled_at is not null) then
    raise exception 'Berilgan pulni faqat bekor qilish mumkin';
  end if;
  return new;
end $$;

create or replace function public.payroll_detail(p_staff uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_perm('payroll.manage') or p_staff = public.current_staff_id()) then raise exception 'Ruxsat yo''q'; end if;
  return jsonb_build_object(
    'works', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'order_no', o.order_no, 'client_name', coalesce(o.client_name, c.name, 'Mijoz'), 'task', e.task,
        'quantity', e.quantity, 'amount', e.amount, 'earned_at', e.earned_at,
        'paid', coalesce((select sum(p.amount) from public.worker_payouts p
                          where p.staff_id = e.staff_id and p.order_id = e.order_id and p.task = e.task and p.cancelled_at is null), 0)
      ) order by e.earned_at desc)
      from public.worker_earnings e join public.orders o on o.id = e.order_id left join public.clients c on c.id = o.client_id
      where e.staff_id = p_staff and o.deleted_at is null and e.earned_at >= p_from and e.earned_at < p_to), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'paid_at', p.paid_at, 'note', p.note,
        'task', p.task, 'client_name', coalesce(o.client_name, c.name), 'order_no', o.order_no) order by p.paid_at desc)
      from public.worker_payouts p left join public.orders o on o.id = p.order_id left join public.clients c on c.id = o.client_id
      where p.staff_id = p_staff and p.cancelled_at is null and p.paid_at >= p_from and p.paid_at < p_to), '[]'::jsonb),
    'balance', coalesce((select sum(e.amount) from public.worker_earnings e join public.orders o on o.id = e.order_id
                         where e.staff_id = p_staff and o.deleted_at is null), 0)
             - coalesce((select sum(p.amount) from public.worker_payouts p where p.staff_id = p_staff and p.cancelled_at is null), 0)
  );
end $$;
