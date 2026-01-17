alter table if exists public.warehouse_floors
add column if not exists standard_pallet_height_m numeric not null default 1.5,
add column if not exists euro_pallet_height_m numeric not null default 1.5;
