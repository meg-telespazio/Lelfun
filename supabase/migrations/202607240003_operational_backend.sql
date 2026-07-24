begin;

create table if not exists public.tenant_deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('Caja', 'Banco', 'Tarjeta', 'Caja Fuerte')),
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  balance numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cost_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.cost_categories(id) on delete set null,
  code text not null,
  name text not null,
  is_leaf boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  counterparty_type text not null
    check (counterparty_type in ('Cliente', 'Proveedor', 'Contratista', 'Inversor')),
  tax_id text,
  contact_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.cost_categories(id) on delete set null,
  code text not null,
  title text not null,
  status text not null default 'PENDING' check (status in (
    'PENDING', 'APPROVED', 'RFQ', 'ORDERED', 'RECEIVED',
    'INVOICED', 'PAID', 'REJECTED'
  )),
  requested_by text,
  required_date date,
  estimated_total numeric(20,2) not null default 0,
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  description text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null,
  estimated_price numeric(20,2) not null default 0,
  actual_price numeric(20,2),
  supplier_id uuid references public.counterparties(id) on delete set null,
  received_quantity numeric(18,4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  target_account_id uuid references public.financial_accounts(id) on delete restrict,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  category_id uuid references public.cost_categories(id) on delete set null,
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  consolidation_amount numeric(20,2) not null,
  exchange_rate numeric(20,6) not null check (exchange_rate > 0),
  exchange_rate_date date not null,
  movement_type text not null check (movement_type in ('INGRESO', 'EGRESO', 'TRANSFERENCIA')),
  description text not null,
  status text not null check (status in (
    'DRAFT', 'PENDING_VALIDATION', 'OBSERVED', 'APPROVED',
    'POSTED', 'REJECTED', 'CANCELLED', 'REVERSED'
  )),
  movement_date date not null,
  performed_by text,
  approved_by text,
  audit_trail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_counts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  count_date date not null,
  system_balance numeric(20,2) not null,
  physical_balance numeric(20,2) not null,
  difference numeric(20,2) not null,
  currency text not null check (currency in ('ARS', 'USD', 'BRL')),
  status text not null check (status in ('OPEN', 'PENDING_APPROVAL', 'APPROVED', 'OBSERVED')),
  performed_by text,
  approved_by text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.official_exchange_rates (
  rate_date date primary key,
  currency text not null default 'USD' check (currency = 'USD'),
  buy_rate numeric(20,6) not null check (buy_rate > 0),
  sell_rate numeric(20,6) not null check (sell_rate > 0),
  source text not null default 'dolarapi-oficial',
  source_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_url text,
  document_date date,
  issuer text,
  document_number text,
  amount numeric(20,2),
  tax_amount numeric(20,2),
  currency text check (currency in ('ARS', 'USD', 'BRL')),
  category_id uuid references public.cost_categories(id) on delete set null,
  confidence numeric(5,4) not null default 0,
  status text not null check (status in ('PENDING_VALIDATION', 'PROCESSED', 'REJECTED')),
  raw_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.early_condominiums (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  handover_date date,
  maintenance_months integer not null default 0,
  units jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.sellable_units(id) on delete set null,
  reporter_name text not null,
  reporter_contact text,
  description text not null,
  reported_date date not null,
  status text not null check (status in ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
  warranty_coverage text not null check (warranty_coverage in ('COVERED', 'NOT_COVERED', 'UNDER_INVESTIGATION')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  categories text[] not null default '{}',
  service_areas text[] not null default '{}',
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  contact_email text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  deadline timestamptz,
  category text,
  status text not null check (status in ('OPEN', 'CLOSED', 'AWARDED')),
  bids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists financial_accounts_tenant_idx on public.financial_accounts (tenant_id);
create index if not exists counterparties_tenant_type_idx on public.counterparties (tenant_id, counterparty_type);
create index if not exists purchase_requests_project_idx on public.purchase_requests (project_id, status);
create index if not exists financial_movements_tenant_date_idx on public.financial_movements (tenant_id, movement_date desc);
create index if not exists cash_counts_account_date_idx on public.cash_counts (account_id, count_date desc);
create index if not exists maintenance_project_idx on public.maintenance_requests (project_id, status);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'financial_accounts', 'cost_categories', 'counterparties',
    'purchase_requests', 'financial_movements', 'early_condominiums',
    'maintenance_requests', 'marketplace_suppliers', 'public_tenders'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenant_deposits', 'financial_accounts', 'cost_categories', 'counterparties',
    'purchase_requests', 'financial_movements', 'cash_counts', 'ocr_documents',
    'early_condominiums', 'maintenance_requests', 'public_tenders'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I_tenant_access on public.%I', table_name, table_name);
    execute format(
      'create policy %I_tenant_access on public.%I for all to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id))',
      table_name, table_name
    );
  end loop;
end;
$$;

alter table public.purchase_items enable row level security;
drop policy if exists purchase_items_tenant_access on public.purchase_items;
create policy purchase_items_tenant_access on public.purchase_items for all to authenticated
using (exists (
  select 1 from public.purchase_requests pr
  where pr.id = purchase_request_id and public.is_tenant_member(pr.tenant_id)
))
with check (exists (
  select 1 from public.purchase_requests pr
  where pr.id = purchase_request_id and public.is_tenant_member(pr.tenant_id)
));

alter table public.official_exchange_rates enable row level security;
drop policy if exists official_rates_authenticated_read on public.official_exchange_rates;
create policy official_rates_authenticated_read on public.official_exchange_rates
for select to authenticated using (true);

alter table public.marketplace_suppliers enable row level security;
drop policy if exists marketplace_suppliers_authenticated_read on public.marketplace_suppliers;
create policy marketplace_suppliers_authenticated_read on public.marketplace_suppliers
for select to authenticated using (true);
drop policy if exists marketplace_suppliers_admin_write on public.marketplace_suppliers;
create policy marketplace_suppliers_admin_write on public.marketplace_suppliers
for all to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.user_id = auth.uid() and tm.active and tm.role in ('owner', 'admin')
))
with check (exists (
  select 1 from public.tenant_members tm
  where tm.user_id = auth.uid() and tm.active and tm.role in ('owner', 'admin')
));

commit;
