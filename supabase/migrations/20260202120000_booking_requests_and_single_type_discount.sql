-- Booking requests: client submits a request (not instant booking); warehouse can quote and convert to booking.
-- Warehouse admin can set single_type_discount_percent (e.g. 20%) for single-type product requests.

-- Table: booking_requests
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  requested_by_id uuid references auth.users(id) on delete set null,
  average_pallet_days int not null check (average_pallet_days >= 1),
  requested_floor text,
  owner_of_product text,
  sku_count int not null check (sku_count >= 1),
  is_single_type boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'quoted', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_requests_customer_id on public.booking_requests(customer_id);
create index if not exists idx_booking_requests_status on public.booking_requests(status);

alter table public.booking_requests enable row level security;

-- RLS: customers see own requests; warehouse staff see requests (later can scope by warehouse/region)
drop policy if exists "booking_requests_select_own" on public.booking_requests;
create policy "booking_requests_select_own"
  on public.booking_requests for select
  to authenticated
  using (
    customer_id = auth.uid()
    or requested_by_id = auth.uid()
  );

drop policy if exists "booking_requests_insert_own" on public.booking_requests;
create policy "booking_requests_insert_own"
  on public.booking_requests for insert
  to authenticated
  with check (customer_id = auth.uid() or requested_by_id = auth.uid());

drop policy if exists "booking_requests_update_own" on public.booking_requests;
create policy "booking_requests_update_own"
  on public.booking_requests for update
  to authenticated
  using (customer_id = auth.uid() or requested_by_id = auth.uid())
  with check (customer_id = auth.uid() or requested_by_id = auth.uid());

-- Warehouse: add single_type_discount_percent (0-100). Warehouse admin can set e.g. 20 for 20% off single-type.
alter table public.warehouses
  add column if not exists single_type_discount_percent numeric(5,2) default null
  check (single_type_discount_percent is null or (single_type_discount_percent >= 0 and single_type_discount_percent <= 100));

comment on column public.warehouses.single_type_discount_percent is 'Discount % for single-type product requests (e.g. 20 for 20%). Set by warehouse admin.';

-- Trigger: updated_at
create or replace function update_booking_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_booking_requests_updated_at on public.booking_requests;
create trigger update_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function update_booking_requests_updated_at();
