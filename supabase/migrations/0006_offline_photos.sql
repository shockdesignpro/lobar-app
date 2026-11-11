-- ============================================================
-- Lobar Parda — 0006: internetsiz ishlash, andoza rasmlari, eski ma'lumotlarni ko'chirish
--  * Buyurtma raqami (id) endi telefonning o'zida yaratiladi: internet yo'qligida
--    kiritilgan buyurtma, uning to'lovlari va holatlari keyin xuddi shu id bilan yuboriladi.
--    Bir xil so'rov ikki marta kelsa ham buyurtma ikkilanmaydi.
--  * Andoza rasmlariga izoh (photo_captions) — rasmlar ro'yxati (photos) bilan bir xil tartibda.
--  * Eski ilovadan ko'chirishda (faqat Admin) asl sana va chek raqami saqlanadi.
-- ============================================================

alter table public.orders add column if not exists photo_captions text[] not null default '{}';

-- Ishchilar ko'rinishiga izohlar qo'shiladi (ustun oxiriga qo'shilgani uchun "replace" yetarli)
create or replace view public.work_orders with (security_barrier) as
  select o.id, o.order_year, o.order_no, o.ready_date, o.status, o.notes, o.photos,
         c.name as client_name,
         case when public.has_perm('clients.contact_view') then c.phone   end as client_phone,
         case when public.has_perm('clients.contact_view') then c.address end as client_address,
         o.updated_at, o.photo_captions
  from public.orders o left join public.clients c on c.id = o.client_id
  where o.deleted_at is null and public.can_see_order(o.id);

create or replace function public.save_order(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_order   uuid := nullif(p->>'order_id', '')::uuid;
  v_client  uuid;
  v_phone   text := nullif(trim(p->'client'->>'phone'), '');
  v_total   numeric := 0;
  v_exists  boolean := false;
  v_photos  text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'photos', '[]'::jsonb))), '{}');
  v_caps    text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'photo_captions', '[]'::jsonb))), '{}');
  v_created timestamptz;
  v_no      int;
  v_year    int;
  v_room    jsonb;
  v_open    jsonb;
  v_item    jsonb;
  v_result  jsonb;
begin
  if not public.has_perm('orders.edit') then
    raise exception 'Buyurtma kiritishga ruxsatingiz yo''q';
  end if;
  if coalesce(trim(p->'client'->>'name'), '') = '' then
    raise exception 'Mijoz ismini kiriting';
  end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'Kamida bitta mahsulot yoki xizmat qo''shing';
  end if;
  -- Rasm faqat shu buyurtma papkasidan bo'lishi mumkin (boshqa buyurtma rasmiga havola qilinmaydi)
  if v_order is not null and exists (select 1 from unnest(v_photos) f where f not like v_order::text || '/%') then
    raise exception 'Rasm manzili noto''g''ri';
  end if;

  -- Asl sana va chek raqami faqat Admin eski ma'lumotlarni ko'chirganda qabul qilinadi
  if public.is_admin() and coalesce((p->>'imported')::boolean, false) then
    v_created := nullif(p->>'created_at', '')::timestamptz;
    v_year    := nullif(p->>'order_year', '')::int;
    v_no      := nullif(p->>'order_no', '')::int;
    if v_no is not null and exists (select 1 from public.orders where order_year = v_year and order_no = v_no and id is distinct from v_order) then
      v_no := null;  -- raqam band bo'lsa, yangi raqam beriladi
    end if;
  end if;

  select coalesce(sum((i->>'quantity')::numeric * (i->>'unit_price')::numeric), 0)
    into v_total from jsonb_array_elements(p->'items') i;

  if v_phone is not null then
    select id into v_client from public.clients where phone = v_phone and deleted_at is null order by created_at limit 1;
  end if;
  if v_client is null then
    insert into public.clients (name, phone, address)
      values (trim(p->'client'->>'name'), v_phone, nullif(trim(p->'client'->>'address'), ''))
      returning id into v_client;
  else
    update public.clients set name = trim(p->'client'->>'name'), address = nullif(trim(p->'client'->>'address'), '')
      where id = v_client;
  end if;

  if v_order is not null then
    select true into v_exists from public.orders where id = v_order;
    v_exists := coalesce(v_exists, false);
  end if;

  if not v_exists then
    insert into public.orders (id, client_id, ready_date, total, status, photos, photo_captions, created_at, order_year, order_no)
      values (coalesce(v_order, gen_random_uuid()), v_client, nullif(p->>'ready_date', '')::date, v_total, 'active', v_photos, v_caps,
              coalesce(v_created, now()), case when v_no is not null then v_year end, v_no)
      returning id into v_order;
  else
    update public.orders set client_id = v_client, ready_date = nullif(p->>'ready_date', '')::date, total = v_total,
           photos = v_photos, photo_captions = v_caps
      where id = v_order and deleted_at is null;
    if not found then raise exception 'Buyurtma topilmadi'; end if;
    update public.order_items set deleted_at = now() where order_id = v_order and deleted_at is null;
    update public.openings set deleted_at = now()
      where room_id in (select id from public.rooms where order_id = v_order) and deleted_at is null;
    update public.rooms set deleted_at = now() where order_id = v_order and deleted_at is null;
  end if;

  for v_room in select * from jsonb_array_elements(coalesce(p->'rooms', '[]'::jsonb)) loop
    insert into public.rooms (id, order_id, name, sort_order)
      values ((v_room->>'id')::uuid, v_order, coalesce(nullif(trim(v_room->>'name'), ''), 'Xona'), coalesce((v_room->>'sort_order')::int, 0))
      on conflict (id) do update set order_id = excluded.order_id, name = excluded.name, sort_order = excluded.sort_order, deleted_at = null;
    for v_open in select * from jsonb_array_elements(coalesce(v_room->'openings', '[]'::jsonb)) loop
      insert into public.openings (id, room_id, kind, height, width, rail_type, color, auto_off, sort_order)
        values ((v_open->>'id')::uuid, (v_room->>'id')::uuid, coalesce(v_open->>'kind', 'deraza'), v_open->>'height', v_open->>'width',
                v_open->>'rail_type', v_open->>'color', coalesce(v_open->'auto_off', '{}'::jsonb), coalesce((v_open->>'sort_order')::int, 0))
        on conflict (id) do update set room_id = excluded.room_id, kind = excluded.kind, height = excluded.height, width = excluded.width,
          rail_type = excluded.rail_type, color = excluded.color, auto_off = excluded.auto_off, sort_order = excluded.sort_order, deleted_at = null;
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (id, order_id, room_id, opening_id, section, product_id, product_name, unit, quantity, unit_price,
                                    linked_from_width, auto_sync, sort_order)
      values ((v_item->>'id')::uuid, v_order, nullif(v_item->>'room_id', '')::uuid, nullif(v_item->>'opening_id', '')::uuid,
              v_item->>'section', nullif(v_item->>'product_id', '')::uuid, v_item->>'product_name', v_item->>'unit',
              (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
              coalesce((v_item->>'linked_from_width')::boolean, false), coalesce((v_item->>'auto_sync')::boolean, false),
              coalesce((v_item->>'sort_order')::int, 0))
      on conflict (id) do update set order_id = excluded.order_id, room_id = excluded.room_id, opening_id = excluded.opening_id,
        section = excluded.section, product_id = excluded.product_id, product_name = excluded.product_name, unit = excluded.unit,
        quantity = excluded.quantity, unit_price = excluded.unit_price, linked_from_width = excluded.linked_from_width,
        auto_sync = excluded.auto_sync, sort_order = excluded.sort_order, deleted_at = null;
  end loop;

  select jsonb_build_object('id', o.id, 'order_year', o.order_year, 'order_no', o.order_no, 'total', o.total)
    into v_result from public.orders o where o.id = v_order;
  return v_result;
end $$;

revoke execute on function public.save_order(jsonb) from public, anon;
grant execute on function public.save_order(jsonb) to authenticated;

-- To'lov sanasi: odatda server vaqti. Faqat Admin eski ma'lumotni ko'chirganda asl sana qoldiriladi,
-- internetsiz kiritilgan to'lov esa kiritilgan paytidagi vaqt bilan (7 kundan eski bo‘lmasa) saqlanadi.
create or replace function public.tg_payment_time() returns trigger
language plpgsql as $$
begin
  if new.paid_at is null or new.paid_at > now() + interval '5 minutes'
     or (new.paid_at < now() - interval '7 days' and not public.is_admin()) then
    new.paid_at := now();
  end if;
  return new;
end $$;
drop trigger if exists payment_time on public.payments;
create trigger payment_time before insert on public.payments
  for each row execute function public.tg_payment_time();
