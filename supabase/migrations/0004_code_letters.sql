-- ============================================================
-- Lobar Parda — 0004: kodda harflar ham bo'lishi mumkin
-- Kod: bo'sh joysiz, Admin 8+, Direktor 6+, Tikuvchi va Usta 4+ belgi, ko'pi bilan 32.
-- ============================================================
create or replace function public.assert_valid_code(p_role text, p_code text) returns void
language plpgsql immutable as $$
begin
  if p_code is null or p_code ~ '[[:space:]]' or p_code = '' then
    raise exception 'Kodda bo''sh joy bo''lmasligi kerak';
  end if;
  if length(p_code) < public.code_min_length(p_role) or length(p_code) > 32 then
    raise exception 'Kod uzunligi % dan 32 tagacha belgi bo''lishi kerak', public.code_min_length(p_role);
  end if;
end $$;
