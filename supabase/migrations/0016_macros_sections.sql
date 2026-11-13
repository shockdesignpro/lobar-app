-- ============================================================
-- Lobar Parda — 0016: makroslar erkin — istalgancha qo'shiladi va har biri
-- Xarajatlar, Tikish yoki O'rnatish bo'limiga tegishli bo'ladi
-- ============================================================
alter table public.macros drop constraint if exists macros_kind_check;
alter table public.macros alter column kind set default 'custom';
alter table public.macros add column if not exists section text not null default 'mahsulot';
do $$ begin
  alter table public.macros add constraint macros_section_check check (section in ('mahsulot','tikish','ustanovka'));
exception when duplicate_object then null; end $$;
