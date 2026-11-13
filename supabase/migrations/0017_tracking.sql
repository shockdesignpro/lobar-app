-- ============================================================
-- Lobar Parda — 0017: mijoz uchun buyurtma kuzatish sahifasi
--  Havola: https://parda.expo.app/?t=<kod>. Kod — buyurtma id'sining qisqa yozuvi (22 belgi,
--  tasodifiy, taxmin qilib bo'lmaydi). Kirish/parol shart emas; faqat shu buyurtma ko'rinadi.
--  Ichki ma'lumotlar (ish haqi, xarajat, foyda, xodimlar, mijoz telefoni/manzili) qaytarilmaydi.
-- ============================================================

-- Atelye ma'lumotlari (Admin panel → Atelye)
insert into public.app_settings (key, value) values
  ('atelier_phone', '""'::jsonb),
  ('atelier_address', '""'::jsonb)
on conflict (key) do nothing;

-- Kodni buyurtma id'siga aylantirish (base64url 22 belgi yoki oddiy uuid)
create or replace function public.track_order_id(p_token text) returns uuid
language plpgsql immutable as $$
declare v text := trim(coalesce(p_token, ''));
begin
  if v ~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then return v::uuid; end if;
  if v !~ '^[A-Za-z0-9_-]{22}$' then return null; end if;
  return encode(decode(translate(v, '-_', '+/') || '==', 'base64'), 'hex')::uuid;
exception when others then return null;
end $$;

create or replace function public.track_order(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid := public.track_order_id(p_token);
  o public.orders;
  v_steps jsonb;
  v_installed timestamptz;
  v_paid numeric;
  v_rooms jsonb;
  v_general jsonb;
  v_name text;
  st record;
begin
  if v_id is null then return null; end if;
  select * into o from public.orders where id = v_id and deleted_at is null and status <> 'draft';
  if o.id is null then return null; end if;

  select coalesce(nullif(trim(o.client_name), ''), c.name, '') into v_name from (select 1) x left join public.clients c on c.id = o.client_id;
  select done_at into v_installed from public.order_steps where order_id = o.id and step_key = 'parda_ornatish' and done and deleted_at is null;

  -- O'rnatilganiga 30 kundan oshgan bo'lsa — yakunlangan
  if v_installed is not null and v_installed < now() - interval '30 days' then
    return jsonb_build_object('closed', true, 'order_no', o.order_no, 'client', split_part(v_name, ' ', 1));
  end if;

  -- Ichki 10 bosqich -> mijoz uchun 5 ta sodda bosqich
  select
    bool_or(step_key = 'sotib_olindi' and done) as bought, max(done_at) filter (where step_key = 'sotib_olindi' and done) as bought_at,
    bool_or(step_key in ('tikuvchiga_berildi','bichildi','chetlari_tikildi','boy_chiqarildi','tepasi_tikildi','dazmolandi') and done) as sewing,
    min(done_at) filter (where step_key in ('tikuvchiga_berildi','bichildi','chetlari_tikildi','boy_chiqarildi','tepasi_tikildi','dazmolandi') and done) as sewing_at,
    bool_or(step_key = 'dazmolandi' and done) as ready, max(done_at) filter (where step_key = 'dazmolandi' and done) as ready_at
  into st
  from public.order_steps where order_id = o.id and deleted_at is null;

  v_steps := jsonb_build_array(
    jsonb_build_object('key', 'accepted',  'label', 'Buyurtma qabul qilindi', 'done', true, 'at', o.created_at),
    jsonb_build_object('key', 'bought',    'label', 'Mato xarid qilindi',     'done', coalesce(st.bought, false) or coalesce(st.sewing, false), 'at', st.bought_at),
    jsonb_build_object('key', 'sewing',    'label', 'Tikilmoqda',             'done', coalesce(st.ready, false), 'started', coalesce(st.sewing, false), 'at', coalesce(st.ready_at, st.sewing_at)),
    jsonb_build_object('key', 'ready',     'label', 'Tayyor',                 'done', coalesce(st.ready, false), 'at', st.ready_at),
    jsonb_build_object('key', 'installed', 'label', 'O‘rnatildi',             'done', v_installed is not null, 'at', v_installed)
  );

  select coalesce(sum(amount), 0) into v_paid from public.payments
  where order_id = o.id and cancelled_at is null and deleted_at is null;

  -- Buyurtma tarkibi: xonalar -> derazalar/eshiklar -> qatorlar
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', r.name,
           'openings', coalesce((select jsonb_agg(jsonb_build_object('id', op.id, 'kind', op.kind, 'height', op.height, 'width', op.width,
                                                                       'rail', op.rail_type, 'color', op.color) order by op.sort_order)
                                 from public.openings op where op.room_id = r.id and op.deleted_at is null), '[]'::jsonb),
           'items', coalesce((select jsonb_agg(jsonb_build_object('section', i.section, 'name', i.product_name, 'unit', i.unit,
                                                                    'qty', i.quantity, 'price', i.unit_price, 'opening', i.opening_id) order by i.sort_order)
                              from public.order_items i where i.room_id = r.id and i.deleted_at is null), '[]'::jsonb)
         ) order by r.sort_order), '[]'::jsonb)
    into v_rooms
  from public.rooms r where r.order_id = o.id and r.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('section', i.section, 'name', i.product_name, 'unit', i.unit,
                                               'qty', i.quantity, 'price', i.unit_price, 'opening', null) order by i.sort_order), '[]'::jsonb)
    into v_general
  from public.order_items i where i.order_id = o.id and i.room_id is null and i.deleted_at is null;

  return jsonb_build_object(
    'closed', false,
    'order_no', o.order_no, 'order_year', o.order_year,
    'client', v_name,
    'created_at', o.created_at, 'ready_date', o.ready_date,
    'steps', v_steps,
    'total', o.total, 'discount_percent', o.discount_percent, 'paid', v_paid, 'remaining', greatest(o.total - v_paid, 0),
    'rooms', v_rooms, 'general', v_general,
    'atelier', jsonb_build_object(
      'phone', (select value #>> '{}' from public.app_settings where key = 'atelier_phone'),
      'address', (select value #>> '{}' from public.app_settings where key = 'atelier_address'))
  );
end $$;

revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;
