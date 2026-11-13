-- ============================================================
-- Lobar Parda — 0015: bildirishnomalar saqlanadi
--  Har bir xabar endi bazaga ham yoziladi. Xodim o'sha paytda ilovaga kirmagan bo'lsa
--  (telefon manzili yo'q), xabar yo'qolmaydi: keyingi kirishda telefoniga birdaniga keladi
--  va burger menyudagi "Bildirishnomalar" bo'limida ko'rinadi.
-- ============================================================

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  kind        text,
  pushed      boolean not null default false,   -- telefonga yuborilganmi
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_staff on public.notifications (staff_id, created_at desc);

alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (staff_id = public.current_staff_id());

-- Yuboruvchi: endi har bir oluvchi uchun yozuv qoldiradi
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

  insert into public.notifications (staff_id, title, body, data, kind, pushed)
  select s, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_kind,
         exists (select 1 from public.push_tokens t where t.staff_id = s)
  from unnest(v_staff) s;

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
    begin
      insert into public.push_log (kind, staff_ids, tokens, title, body, error)
        values (p_kind, v_staff, coalesce(array_length(v_tokens, 1), 0), p_title, p_body, sqlerrm);
    exception when others then null; end;
  end;
end $$;
revoke all on function public.push_send(uuid[], text, text, jsonb, text) from public, anon, authenticated;

-- Kirgandan keyin: telefonga yetmay qolgan xabarlarni (oxirgi 7 kun, ko'pi bilan 20 ta) oladi
create or replace function public.take_missed_notifications() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_staff_id(); v_out jsonb;
begin
  if v_me is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'data', data) order by created_at), '[]'::jsonb)
    into v_out
  from (select * from public.notifications
        where staff_id = v_me and not pushed and read_at is null and created_at > now() - interval '7 days'
        order by created_at desc limit 20) x;
  update public.notifications set pushed = true where staff_id = v_me and not pushed;
  return v_out;
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where staff_id = public.current_staff_id() and read_at is null;
$$;

revoke all on function public.take_missed_notifications() from public, anon;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.take_missed_notifications() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

-- Eskilari (60 kundan ortiq) har kuni tozalanadi
create or replace function public.push_unassigned_check_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from public.notifications where created_at < now() - interval '60 days';
$$;
revoke all on function public.push_unassigned_check_cleanup() from public, anon, authenticated;
select cron.schedule('lobar-notifications-cleanup', '30 4 * * *', 'select public.push_unassigned_check_cleanup()');
