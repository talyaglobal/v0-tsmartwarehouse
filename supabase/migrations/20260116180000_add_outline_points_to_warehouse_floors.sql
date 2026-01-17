alter table if exists public.warehouse_floors
add column if not exists outline_points jsonb;
