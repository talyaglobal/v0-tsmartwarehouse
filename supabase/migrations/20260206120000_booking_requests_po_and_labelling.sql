-- Add PO (Purchase Order) info and labelling requirement to booking_requests.
-- Used when adding/editing a booking request (e.g. on behalf of another client).

alter table public.booking_requests
  add column if not exists po_info text,
  add column if not exists is_labelling_required boolean not null default false;

comment on column public.booking_requests.po_info is 'Purchase order reference or info (free text).';
comment on column public.booking_requests.is_labelling_required is 'Whether labelling is required for this request.';
