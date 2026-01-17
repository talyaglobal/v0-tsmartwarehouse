alter table if exists public.warehouse_floors
add column if not exists height_m numeric not null default 10;
