begin;

alter table public.marketplace_direct_requests
  add column if not exists last_action_by uuid references auth.users(id) on delete set null,
  add column if not exists last_action_at timestamptz,
  add column if not exists buyer_response text;

create table if not exists public.marketplace_direct_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_direct_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('BUYER','SUPPLIER','SYSTEM')),
  event_type text not null check (event_type in ('CREATED','ACCEPTED','REJECTED','CHANGES_PROPOSED','CHANGES_ACCEPTED','CANCELLED','COMPLETED','COMMENT')),
  message text,
  proposed_items jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_direct_request_events_request_idx
  on public.marketplace_direct_request_events(request_id,created_at);

alter table public.marketplace_direct_request_events enable row level security;

drop policy if exists marketplace_direct_request_events_parties on public.marketplace_direct_request_events;
create policy marketplace_direct_request_events_parties
on public.marketplace_direct_request_events for select to authenticated using (
  public.is_platform_admin() or exists (
    select 1 from public.marketplace_direct_requests r
    where r.id=request_id and (public.is_tenant_member(r.tenant_id) or public.is_supplier_member(r.supplier_id))
  )
);

commit;
