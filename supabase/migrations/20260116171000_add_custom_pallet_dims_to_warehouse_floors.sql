alter table if exists public.warehouse_floors
add column if not exists custom_pallet_length_cm numeric not null default 100,
add column if not exists custom_pallet_width_cm numeric not null default 100;
