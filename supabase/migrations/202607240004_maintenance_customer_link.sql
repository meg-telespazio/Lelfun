begin;

alter table public.maintenance_requests
  add column if not exists customer_id uuid
  references public.counterparties(id) on delete set null;

create index if not exists maintenance_requests_customer_idx
  on public.maintenance_requests (customer_id);

commit;
