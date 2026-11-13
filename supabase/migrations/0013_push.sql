-- ============================================================
-- Lobar Parda — 0013: telefonlarga bildirishnoma (push)
--  Ilova telefonning push-manzilini (token) shu yerga yozadi. Buyurtmada biror narsa
--  o'zgarganda baza o'zi Expo orqali (Expo -> Firebase -> telefon) xabar yuboradi.
--  Xabar tranzaksiya muvaffaqiyatli tugagandan keyingina jo'natiladi (pg_net navbati).
--  Xabar yuborishda xato bo'lsa ham asosiy ish (saqlash, belgilash) hech qachon to'xtamaydi.
-- ============================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 1. Telefonlar manzillari --------------------------------------------------
create table if not exists public.push_tokens (
  token       text primary key,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_staff on public.push_tokens (staff_id);
alter table public.push_tokens enable row level security;   -- to'g'ridan-to'g'ri o'qib bo'lmaydi, faqat funksiyalar orqali

-- Yuborilgan xabarlar jurnali (tekshirish uchun; 30 kundan eskisi o'chadi)
create table if not exists public.push_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text,
  staff_ids   uuid[],
  tokens      int,
  title       text,
  body        text,
  error       text
);
alter table public.push_log enable row level security;

create or replace function public.register_push_token(p_token text, p_platform text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_staff_id();
begin
  if v_me is null then raise exception 'Kirilmagan'; end if;
  if p_token is null or length(p_token) < 10 or length(p_token) > 300 then raise exception 'Noto''g''ri token'; end if;
  -- Bir telefonga boshqa xodim kirsa, manzil yangi egasiga o'tadi
  insert into public.push_tokens (token, staff_id, platform, updated_at) values (p_token, v_me, p_platform, now())
  on conflict (token) do update set staff_id = excluded.staff_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and staff_id = public.current_staff_id();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 2. Yordamchilar -----------------------------------------------------------
create or replace function public.push_money(p numeric) returns text
language sql immutable as $$ select replace(to_char(round(p), 'FM999,999,999,990'), ',', ' ') $$;

create or replace function public.push_order_label(p_order uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce('№' || lpad(o.order_no::text, 4, '0') || ' · ', '')
         || coalesce(nullif(trim(o.client_name), ''), nullif(trim(c.name), ''), 'Buyurtma')
  from public.orders o left join public.clients c on c.id = o.client_id
  where o.id = p_order
$$;

create or replace function public.push_bosses() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.staff
  where role_id in ('admin', 'direktor') and is_active and deleted_at is null
$$;

create or replace function public.push_task_name(p_task text) returns text
language sql immutable as $$ select case p_task when 'tikish' then 'tikish' when 'ornatish' then 'o‘rnatish' else p_task end $$;

-- Asosiy yuboruvchi. Harakatni qilgan odamning o'ziga xabar bormaydi.
create or replace function public.push_send(p_staff uuid[], p_title text, p_body text, p_data jsonb default '{}', p_kind text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_staff_id();
  v_staff uuid[];
  v_tokens text[];
begin
  v_staff := array(select distinct s.id from public.staff s
                   where s.id = any(p_staff) and s.is_active and s.deleted_at is null
                     and s.id is distinct from v_me);
  if coalesce(array_length(v_staff, 1), 0) = 0 then return; end if;
  v_tokens := array(select t.token from public.push_tokens t where t.staff_id = any(v_staff));
  begin
    if coalesce(array_length(v_tokens, 1), 0) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', to_jsonb(v_tokens), 'title', p_title, 'body', p_body,
                                   'data', coalesce(p_data, '{}'::jsonb), 'sound', 'default',
                                   'channelId', 'orders', 'priority', 'high'),
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    end if;
    insert into public.push_log (kind, staff_ids, tokens, title, body)
      values (p_kind, v_staff, coalesce(array_length(v_tokens, 1), 0), p_title, p_body);
  exception when others then
    -- Xabar ketmasa ham asosiy ish bekor bo'lmasin
    begin
      insert into public.push_log (kind, staff_ids, tokens, title, body, error)
        values (p_kind, v_staff, coalesce(array_length(v_tokens, 1), 0), p_title, p_body, sqlerrm);
    exception when others then null; end;
  end;
end $$;

revoke all on function public.push_send(uuid[], text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.push_bosses() from public, anon, authenticated;
revoke all on function public.push_order_label(uuid) from public, anon, authenticated;

-- 3. Biriktirish / olib tashlash -------------------------------------------
create or replace function public.tg_push_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_on boolean; v_off boolean; v_ord public.orders; v_body text;
begin
  v_on  := new.deleted_at is null and (tg_op = 'INSERT' or old.deleted_at is not null);
  v_off := tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null;
  if not (v_on or v_off) then return null; end if;
  select * into v_ord from public.orders where id = new.order_id;
  if v_ord.id is null or v_ord.deleted_at is not null or v_ord.status in ('cancelled', 'draft') then return null; end if;
  if v_on then
    v_body := public.push_order_label(new.order_id) || ' — ' || public.push_task_name(new.task)
              || coalesce('. Topshirish: ' || to_char(v_ord.ready_date, 'DD.MM'), '');
    perform public.push_send(array[new.staff_id], 'Yangi buyurtma', v_body,
                             jsonb_build_object('orderId', new.order_id), 'assign');
  else
    perform public.push_send(array[new.staff_id], 'Buyurtma olib tashlandi',
                             public.push_order_label(new.order_id) || ' (' || public.push_task_name(new.task) || ') sizdan olindi',
                             '{}'::jsonb, 'unassign');
  end if;
  return null;
end $$;
drop trigger if exists push_assignee on public.order_assignees;
create trigger push_assignee after insert or update of deleted_at on public.order_assignees
  for each row execute function public.tg_push_assignee();

-- 4. Topshirish sanasi o'zgarishi ------------------------------------------
create or replace function public.tg_push_ready_date() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_staff uuid[];
begin
  if new.ready_date is not distinct from old.ready_date or new.deleted_at is not null
     or new.status in ('cancelled', 'draft', 'done') then return null; end if;
  v_staff := array(select a.staff_id from public.order_assignees a where a.order_id = new.id and a.deleted_at is null);
  if coalesce(array_length(v_staff, 1), 0) = 0 then return null; end if;
  perform public.push_send(v_staff, 'Topshirish sanasi o‘zgardi',
    public.push_order_label(new.id) || ': '
      || coalesce(to_char(old.ready_date, 'DD.MM'), 'sanasiz') || ' → ' || coalesce(to_char(new.ready_date, 'DD.MM'), 'sanasiz'),
    jsonb_build_object('orderId', new.id), 'date');
  return null;
end $$;
drop trigger if exists push_ready_date on public.orders;
create trigger push_ready_date after update of ready_date on public.orders
  for each row execute function public.tg_push_ready_date();

-- 5. Tikuv tayyor (dazmolandi) va parda o'rnatildi ---------------------------
create or replace function public.tg_push_step() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ord public.orders; v_label text; v_who text; v_usta uuid[];
begin
  if not new.done or new.deleted_at is not null or (tg_op = 'UPDATE' and old.done and old.deleted_at is null) then return null; end if;
  if new.step_key not in ('dazmolandi', 'parda_ornatish') then return null; end if;
  select * into v_ord from public.orders where id = new.order_id;
  if v_ord.id is null or v_ord.deleted_at is not null or v_ord.status in ('cancelled', 'draft') then return null; end if;
  v_label := public.push_order_label(new.order_id);
  select full_name into v_who from public.staff where id = coalesce(new.done_by, public.current_staff_id());

  if new.step_key = 'dazmolandi' then
    v_usta := array(select a.staff_id from public.order_assignees a
                    where a.order_id = new.order_id and a.task = 'ornatish' and a.deleted_at is null);
    perform public.push_send(v_usta, 'O‘rnatishga tayyor',
      v_label || ' — tikuv tugadi' || coalesce('. Topshirish: ' || to_char(v_ord.ready_date, 'DD.MM'), ''),
      jsonb_build_object('orderId', new.order_id), 'ready_usta');
    perform public.push_send(public.push_bosses(), 'Tikuv tayyor',
      v_label || coalesce(' — ' || v_who, ''), jsonb_build_object('orderId', new.order_id), 'ready_boss');
  else
    perform public.push_send(public.push_bosses(), 'Parda o‘rnatildi',
      v_label || coalesce(' — ' || v_who, ''), jsonb_build_object('orderId', new.order_id), 'installed');
  end if;
  return null;
end $$;
drop trigger if exists push_step on public.order_steps;
create trigger push_step after insert or update of done, deleted_at on public.order_steps
  for each row execute function public.tg_push_step();

-- 6. Ish haqi to'landi (bir nechta ish birga to'lansa — bitta xabar) --------
create or replace function public.tg_push_payout() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select staff_id, sum(amount) as total, bool_and(order_id is null) as avans
           from new_rows where cancelled_at is null group by staff_id loop
    perform public.push_send(array[r.staff_id],
      case when r.avans then 'Avans berildi' else 'Ish haqi to‘landi' end,
      'Sizga ' || public.push_money(r.total) || ' so‘m ' || case when r.avans then 'avans berildi' else 'to‘landi' end,
      jsonb_build_object('screen', 'payroll'), 'payout');
  end loop;
  return null;
end $$;
drop trigger if exists push_payout on public.worker_payouts;
create trigger push_payout after insert on public.worker_payouts
  referencing new table as new_rows
  for each statement execute function public.tg_push_payout();

-- 7. Har kuni 09:00 (Toshkent): ertaga topshiriladigan, lekin ishchi biriktirilmagan buyurtmalar
create or replace function public.push_unassigned_check() returns void
language plpgsql security definer set search_path = public as $$
declare v_list text; v_n int; v_tomorrow date := (now() at time zone 'Asia/Tashkent')::date + 1;
begin
  select count(*), string_agg(label || ' (' || missing || ')', ', ' order by label)
    into v_n, v_list
  from (
    select public.push_order_label(o.id) as label,
           concat_ws(', ',
             case when not exists (select 1 from public.order_assignees a where a.order_id = o.id and a.task = 'tikish' and a.deleted_at is null)
                   and not exists (select 1 from public.order_steps s where s.order_id = o.id and s.step_key = 'dazmolandi' and s.done and s.deleted_at is null)
                  then 'tikuvchi' end,
             case when not exists (select 1 from public.order_assignees a where a.order_id = o.id and a.task = 'ornatish' and a.deleted_at is null)
                  then 'usta' end) as missing
    from public.orders o
    where o.deleted_at is null and o.status = 'active' and o.ready_date = v_tomorrow
      and not exists (select 1 from public.order_steps s where s.order_id = o.id and s.step_key = 'parda_ornatish' and s.done and s.deleted_at is null)
  ) x where missing <> '';
  if v_n > 0 then
    perform public.push_send(public.push_bosses(), 'Ishchi biriktirilmagan',
      'Ertaga topshiriladi: ' || v_list, jsonb_build_object('screen', 'orders'), 'unassigned');
  end if;
  delete from public.push_log where created_at < now() - interval '30 days';
end $$;
revoke all on function public.push_unassigned_check() from public, anon, authenticated;

-- 04:00 UTC = 09:00 Toshkent
select cron.schedule('lobar-unassigned', '0 4 * * *', 'select public.push_unassigned_check()');
