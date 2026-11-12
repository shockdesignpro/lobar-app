-- ============================================================
-- Lobar Parda — 0010: har bir buyurtma mijoz ismini o'zida saqlaydi
--  Avval bir xil telefon raqamli buyurtmalar bitta mijoz yozuviga bog'lanib, oxirgi kiritilgan
--  ism hamma buyurtmalarda ko'rinib qolardi. Endi har bir buyurtma ism, telefon va manzilni
--  kiritilgan holatida saqlaydi (eski ilovadagidek). Mijozlar bazasi alohida qoladi.
-- ============================================================

alter table public.orders add column if not exists client_name    text;
alter table public.orders add column if not exists client_phone   text;
alter table public.orders add column if not exists client_address text;

update public.orders o set client_name = c.name, client_phone = c.phone, client_address = c.address
  from public.clients c where c.id = o.client_id and o.client_name is null;

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
    -- Mijozlar bazasidagi yozuv: ism/manzil eng oxirgi kiritilgan bo'yicha yangilanadi,
    -- lekin har bir buyurtma o'z nusxasini (client_name, ...) saqlaydi — eski buyurtmalar o'zgarmaydi
    update public.clients set name = trim(p->'client'->>'name'), address = nullif(trim(p->'client'->>'address'), '')
      where id = v_client;
  end if;

  if v_order is not null then
    select true into v_exists from public.orders where id = v_order;
    v_exists := coalesce(v_exists, false);
  end if;

  if not v_exists then
    insert into public.orders (id, client_id, client_name, client_phone, client_address, ready_date, total, status, photos, photo_captions, created_at, order_year, order_no)
      values (coalesce(v_order, gen_random_uuid()), v_client, trim(p->'client'->>'name'), v_phone, nullif(trim(p->'client'->>'address'), ''),
              nullif(p->>'ready_date', '')::date, v_total, 'active', v_photos, v_caps,
              coalesce(v_created, now()), case when v_no is not null then v_year end, v_no)
      returning id into v_order;
  else
    update public.orders set client_id = v_client, client_name = trim(p->'client'->>'name'), client_phone = v_phone,
           client_address = nullif(trim(p->'client'->>'address'), ''), ready_date = nullif(p->>'ready_date', '')::date, total = v_total,
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

create or replace view public.work_orders with (security_barrier) as
  select o.id, o.order_year, o.order_no, o.ready_date, o.status, o.notes, o.photos,
         coalesce(o.client_name, c.name) as client_name,
         case when public.has_perm('clients.contact_view') then coalesce(o.client_phone, c.phone)     end as client_phone,
         case when public.has_perm('clients.contact_view') then coalesce(o.client_address, c.address) end as client_address,
         o.updated_at, o.photo_captions
  from public.orders o left join public.clients c on c.id = o.client_id
  where o.deleted_at is null and public.can_see_order(o.id);

create or replace function public.payroll_detail(p_staff uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_perm('payroll.manage') or p_staff = public.current_staff_id()) then raise exception 'Ruxsat yo''q'; end if;
  return jsonb_build_object(
    'works', coalesce((select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'order_no', o.order_no, 'client_name', coalesce(o.client_name, c.name, 'Mijoz'), 'task', e.task,
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
