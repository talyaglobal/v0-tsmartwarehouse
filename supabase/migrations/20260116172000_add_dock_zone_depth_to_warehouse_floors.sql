alter table if exists public.warehouse_floors
add column if not exists dock_zone_depth_m numeric not null default 4.5;
