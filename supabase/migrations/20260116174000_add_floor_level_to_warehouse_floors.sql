alter table if exists public.warehouse_floors
add column if not exists floor_level integer not null default 1;
