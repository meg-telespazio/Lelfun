begin;

create table if not exists public.marketplace_tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  document_type text not null default 'GENERAL' check (document_type in ('GENERAL','SPECIFICATION','DRAWING','TERMS','CLARIFICATION')),
  visible_to_suppliers boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_tender_documents_tender_idx
  on public.marketplace_tender_documents(tender_id,created_at);

alter table public.marketplace_tender_documents enable row level security;

drop policy if exists marketplace_tender_documents_read on public.marketplace_tender_documents;
create policy marketplace_tender_documents_read on public.marketplace_tender_documents
for select to authenticated using (
  public.is_platform_admin() or exists (
    select 1 from public.marketplace_tenders t where t.id=tender_id and
    (public.is_tenant_member(t.tenant_id) or (visible_to_suppliers and t.status <> 'DRAFT'))
  )
);

drop policy if exists marketplace_tender_documents_owner on public.marketplace_tender_documents;
create policy marketplace_tender_documents_owner on public.marketplace_tender_documents
for all to authenticated using (
  public.is_platform_admin() or exists (
    select 1 from public.marketplace_tenders t where t.id=tender_id and public.is_tenant_member(t.tenant_id)
  )
) with check (
  public.is_platform_admin() or exists (
    select 1 from public.marketplace_tenders t where t.id=tender_id and public.is_tenant_member(t.tenant_id)
  )
);

commit;
