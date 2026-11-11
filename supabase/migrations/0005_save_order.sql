-- ============================================================
-- Lobar Parda — 0005: buyurtmani bitta tranzaksiyada saqlash
-- Mijoz, buyurtma, xonalar, deraza/eshiklar va xarajat qatorlari birga yoziladi:
-- yoki hammasi saqlanadi, yoki hech biri (yarim buyurtma qolmaydi).
-- Funksiya chaqiruvchi huquqlari bilan ishlaydi, ya'ni RLS ruxsatlari to'liq amal qiladi.
-- ============================================================

alter table public.openings    add column if not exists auto_off  jsonb   not null default '{}'::jsonb;
alter table public.order_items add column if not exists auto_sync boolean not null default false;

create or replace function public.save_order(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_order   uuid := nullif(p->>'order_id', '')::uuid;
  v_client  uuid;
  v_phone   text := nullif(trim(p->'client'->>'phone'), '');
  v_total   numeric := 0;
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

  -- Jami summa serverda qayta hisoblanadi (miqdor × o'sha paytdagi narx)
  select coalesce(sum((i->>'quantity')::numeric * (i->>'unit_price')::numeric), 0)
    into v_total from jsonb_array_elements(p->'items') i;

  -- Mijoz: shu telefon raqamli mijoz bo'lsa yangilanadi, aks holda yangisi qo'shiladi
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

  if v_order is null then
    insert into public.orders (client_id, ready_date, total, status)
      values (v_client, nullif(p->>'ready_date', '')::date, v_total, 'active')
      returning id into v_order;
  else
    update public.orders set client_id = v_client, ready_date = nullif(p->>'ready_date', '')::date, total = v_total
      where id = v_order and deleted_at is null;
    if not found then raise exception 'Buyurtma topilmadi'; end if;
    -- Tahrirlashda eski tarkib arxivga o'tadi, yangisi ustidan yoziladi
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
