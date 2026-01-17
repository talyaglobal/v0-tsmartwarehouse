alter table if exists public.warehouse_floors
add column if not exists loading_zone_depth_m numeric not null default 3.0;
