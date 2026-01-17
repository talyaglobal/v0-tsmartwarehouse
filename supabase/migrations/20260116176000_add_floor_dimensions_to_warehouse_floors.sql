alter table if exists public.warehouse_floors
add column if not exists length_m numeric not null default 50,
add column if not exists width_m numeric not null default 30;
