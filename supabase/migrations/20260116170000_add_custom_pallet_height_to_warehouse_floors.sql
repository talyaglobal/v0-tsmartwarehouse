alter table if exists public.warehouse_floors
add column if not exists custom_pallet_height_cm numeric not null default 150;
