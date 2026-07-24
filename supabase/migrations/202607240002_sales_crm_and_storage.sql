begin;

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  tax_id text,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sellable_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  unit_type text not null check (unit_type in (
    'UNIDAD_FUNCIONAL', 'DEPARTAMENTO', 'CASA', 'COCHERA',
    'LOCAL', 'OFICINA', 'BAULERA', 'LOTE'
  )),
  status text not null default 'AVAILABLE' check (status in (
    'AVAILABLE', 'BLOCKED', 'RESERVED', 'PRE_SOLD',
    'SOLD', 'DELIVERED', 'CANCELLED'
  )),
  description text,
  covered_surface_m2 numeric(14,2) not null default 0 check (covered_surface_m2 >= 0),
  semi_covered_surface_m2 numeric(14,2) not null default 0 check (semi_covered_surface_m2 >= 0),
  uncovered_surface_m2 numeric(14,2) not null default 0 check (uncovered_surface_m2 >= 0),
  total_surface_m2 numeric(14,2) not null default 0 check (total_surface_m2 >= 0),
  floor text,
  rooms integer not null default 0 check (rooms >= 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  view_description text,
  orientation text,
  base_price numeric(18,2) not null default 0 check (base_price >= 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD', 'BRL')),
  financing_description text,
  current_owner_id uuid references public.crm_customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references public.crm_customers(id) on delete restrict,
  title text not null,
  stage text not null default 'LEAD' check (stage in (
    'LEAD', 'CONTACTED', 'VISIT', 'NEGOTIATION', 'RESERVED',
    'WON', 'LOST', 'EXPIRED', 'CANCELLED_BY_CLIENT'
  )),
  reservation_expires_at timestamptz,
  base_price numeric(18,2) not null default 0 check (base_price >= 0),
  negotiated_price numeric(18,2) not null default 0 check (negotiated_price >= 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD', 'BRL')),
  discount_amount numeric(18,2) not null default 0,
  down_payment numeric(18,2) not null default 0 check (down_payment >= 0),
  cash_payment numeric(18,2) not null default 0 check (cash_payment >= 0),
  installment_count integer not null default 0 check (installment_count >= 0),
  installment_amount numeric(18,2) not null default 0 check (installment_amount >= 0),
  reinforcements_amount numeric(18,2) not null default 0 check (reinforcements_amount >= 0),
  possession_balance numeric(18,2) not null default 0 check (possession_balance >= 0),
  financing_rate numeric(9,4) not null default 0,
  index_type text not null default 'NONE' check (index_type in ('NONE', 'CAC', 'INFLATION')),
  base_index_value numeric(18,6) not null default 1 check (base_index_value > 0),
  commission_type text check (commission_type in ('PERCENTAGE', 'FIXED')),
  commission_value numeric(18,4) not null default 0 check (commission_value >= 0),
  seller_name text,
  next_action text,
  next_action_date date,
  notes text,
  loss_reason text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    stage not in ('LOST', 'CANCELLED_BY_CLIENT')
    or nullif(trim(loss_reason), '') is not null
  )
);

create table if not exists public.sales_opportunity_units (
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  unit_id uuid not null references public.sellable_units(id) on delete restrict,
  base_price_at_offer numeric(18,2) not null default 0 check (base_price_at_offer >= 0),
  negotiated_price numeric(18,2) check (negotiated_price is null or negotiated_price >= 0),
  primary key (opportunity_id, unit_id)
);

create table if not exists public.sales_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  opportunity_id uuid unique references public.sales_opportunities(id) on delete restrict,
  customer_id uuid not null references public.crm_customers(id) on delete restrict,
  contract_date date not null default current_date,
  total_price numeric(18,2) not null check (total_price >= 0),
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  down_payment numeric(18,2) not null default 0 check (down_payment >= 0),
  cash_payment numeric(18,2) not null default 0 check (cash_payment >= 0),
  reinforcements_amount numeric(18,2) not null default 0 check (reinforcements_amount >= 0),
  possession_balance numeric(18,2) not null default 0 check (possession_balance >= 0),
  installment_count integer not null default 0 check (installment_count >= 0),
  financing_rate numeric(9,4) not null default 0,
  index_type text not null default 'NONE' check (index_type in ('NONE', 'CAC', 'INFLATION')),
  base_index_value numeric(18,6) not null default 1 check (base_index_value > 0),
  commission_type text check (commission_type in ('PERCENTAGE', 'FIXED')),
  commission_value numeric(18,4) not null default 0 check (commission_value >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_contract_units (
  contract_id uuid not null references public.sales_contracts(id) on delete cascade,
  unit_id uuid not null references public.sellable_units(id) on delete restrict,
  sale_price numeric(18,2) not null check (sale_price >= 0),
  primary key (contract_id, unit_id),
  unique (unit_id)
);

create table if not exists public.sales_installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.sales_contracts(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  installment_type text not null default 'INSTALLMENT'
    check (installment_type in ('DOWN_PAYMENT', 'INSTALLMENT', 'REINFORCEMENT', 'POSSESSION_BALANCE')),
  original_amount numeric(18,2) not null check (original_amount >= 0),
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  due_date date not null,
  index_type text not null default 'NONE' check (index_type in ('NONE', 'CAC', 'INFLATION')),
  base_index_value numeric(18,6) not null default 1 check (base_index_value > 0),
  current_index_value numeric(18,6) not null default 1 check (current_index_value > 0),
  adjusted_amount numeric(18,2) not null default 0 check (adjusted_amount >= 0),
  paid_amount numeric(18,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, installment_number, installment_type)
);

create table if not exists public.sales_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.sellable_units(id) on delete cascade,
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  contract_id uuid references public.sales_contracts(id) on delete cascade,
  bucket_id text not null check (bucket_id in ('sales-media', 'sales-documents')),
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  file_kind text not null default 'OTHER'
    check (file_kind in ('PHOTO', 'RENDER', 'PLAN', 'RESERVATION', 'CONTRACT', 'RECEIPT', 'OTHER')),
  description text,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  check (num_nonnulls(unit_id, opportunity_id, contract_id) >= 1)
);

create index if not exists crm_customers_tenant_idx on public.crm_customers (tenant_id, name);
create index if not exists sellable_units_project_idx on public.sellable_units (project_id, status);
create index if not exists sales_opportunities_project_stage_idx
  on public.sales_opportunities (project_id, stage, updated_at desc);
create index if not exists sales_opportunities_reservation_idx
  on public.sales_opportunities (reservation_expires_at)
  where stage = 'RESERVED';
create index if not exists sales_contracts_project_idx on public.sales_contracts (project_id, contract_date desc);
create index if not exists sales_installments_due_idx on public.sales_installments (due_date, status);
create index if not exists sales_files_project_idx on public.sales_files (project_id, created_at desc);

drop trigger if exists crm_customers_set_updated_at on public.crm_customers;
create trigger crm_customers_set_updated_at before update on public.crm_customers
for each row execute function public.set_updated_at();
drop trigger if exists sellable_units_set_updated_at on public.sellable_units;
create trigger sellable_units_set_updated_at before update on public.sellable_units
for each row execute function public.set_updated_at();
drop trigger if exists sales_opportunities_set_updated_at on public.sales_opportunities;
create trigger sales_opportunities_set_updated_at before update on public.sales_opportunities
for each row execute function public.set_updated_at();
drop trigger if exists sales_contracts_set_updated_at on public.sales_contracts;
create trigger sales_contracts_set_updated_at before update on public.sales_contracts
for each row execute function public.set_updated_at();
drop trigger if exists sales_installments_set_updated_at on public.sales_installments;
create trigger sales_installments_set_updated_at before update on public.sales_installments
for each row execute function public.set_updated_at();

create or replace function public.expire_sales_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with expired as (
    update public.sales_opportunities
    set stage = 'EXPIRED', updated_at = now()
    where stage = 'RESERVED'
      and reservation_expires_at < now()
    returning id
  ),
  released as (
    update public.sellable_units u
    set status = 'AVAILABLE', updated_at = now()
    from public.sales_opportunity_units ou
    join expired e on e.id = ou.opportunity_id
    where u.id = ou.unit_id and u.status = 'RESERVED'
    returning u.id
  )
  select count(*) into affected from expired;
  return affected;
end;
$$;

alter table public.crm_customers enable row level security;
alter table public.sellable_units enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.sales_opportunity_units enable row level security;
alter table public.sales_contracts enable row level security;
alter table public.sales_contract_units enable row level security;
alter table public.sales_installments enable row level security;
alter table public.sales_files enable row level security;

drop policy if exists crm_customers_tenant_access on public.crm_customers;
create policy crm_customers_tenant_access on public.crm_customers for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists sellable_units_project_access on public.sellable_units;
create policy sellable_units_project_access on public.sellable_units for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.is_tenant_member(p.tenant_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_tenant_member(p.tenant_id)));

drop policy if exists sales_opportunities_tenant_access on public.sales_opportunities;
create policy sales_opportunities_tenant_access on public.sales_opportunities for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = tenant_id)
  and exists (select 1 from public.crm_customers c where c.id = customer_id and c.tenant_id = tenant_id)
);

drop policy if exists sales_opportunity_units_access on public.sales_opportunity_units;
create policy sales_opportunity_units_access on public.sales_opportunity_units for all to authenticated
using (exists (
  select 1 from public.sales_opportunities o
  where o.id = opportunity_id and public.is_tenant_member(o.tenant_id)
))
with check (exists (
  select 1
  from public.sales_opportunities o
  join public.sellable_units u on u.id = unit_id and u.project_id = o.project_id
  where o.id = opportunity_id and public.is_tenant_member(o.tenant_id)
));

drop policy if exists sales_contracts_tenant_access on public.sales_contracts;
create policy sales_contracts_tenant_access on public.sales_contracts for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists sales_contract_units_access on public.sales_contract_units;
create policy sales_contract_units_access on public.sales_contract_units for all to authenticated
using (exists (
  select 1 from public.sales_contracts c
  where c.id = contract_id and public.is_tenant_member(c.tenant_id)
))
with check (exists (
  select 1 from public.sales_contracts c
  join public.sellable_units u on u.id = unit_id and u.project_id = c.project_id
  where c.id = contract_id and public.is_tenant_member(c.tenant_id)
));

drop policy if exists sales_installments_access on public.sales_installments;
create policy sales_installments_access on public.sales_installments for all to authenticated
using (exists (
  select 1 from public.sales_contracts c
  where c.id = contract_id and public.is_tenant_member(c.tenant_id)
))
with check (exists (
  select 1 from public.sales_contracts c
  where c.id = contract_id and public.is_tenant_member(c.tenant_id)
));

drop policy if exists sales_files_tenant_access on public.sales_files;
create policy sales_files_tenant_access on public.sales_files for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = tenant_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'sales-media',
    'sales-media',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'sales-documents',
    'sales-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ruta obligatoria:
-- tenant_uuid/project_uuid/unidad|oportunidad|contrato/entity_uuid/nombre.ext
drop policy if exists sales_storage_select on storage.objects;
create policy sales_storage_select on storage.objects for select to authenticated
using (
  bucket_id in ('sales-media', 'sales-documents')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1 from public.projects p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists sales_storage_insert on storage.objects;
create policy sales_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('sales-media', 'sales-documents')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1 from public.projects p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists sales_storage_update on storage.objects;
create policy sales_storage_update on storage.objects for update to authenticated
using (
  bucket_id in ('sales-media', 'sales-documents')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id in ('sales-media', 'sales-documents')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists sales_storage_delete on storage.objects;
create policy sales_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id in ('sales-media', 'sales-documents')
  and public.has_tenant_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'project_manager']
  )
);

grant execute on function public.expire_sales_reservations() to authenticated;

commit;
