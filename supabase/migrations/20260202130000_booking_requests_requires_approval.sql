-- Add requires_approval to booking_requests (for on-behalf requests: company admin can choose pre-approved vs requires approval)
alter table public.booking_requests
  add column if not exists requires_approval boolean not null default true;

comment on column public.booking_requests.requires_approval is 'When true, the client must approve this request before it is confirmed. Company admin can set false for pre-approved (onaylı) requests.';
