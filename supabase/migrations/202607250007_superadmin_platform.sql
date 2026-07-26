begin;

create unique index if not exists tenant_members_one_active_tenant_per_user
on public.tenant_members(user_id) where active;

create table if not exists public.tenant_member_modules (
  tenant_id uuid not null,
  user_id uuid not null,
  module_key text not null check (module_key in ('projects','treasury','budgets','procurement','sales','consortium','ocr','marketplace','tenant_settings')),
  can_read boolean not null default true,
  can_write boolean not null default false,
  can_approve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id,user_id,module_key),
  foreign key (tenant_id,user_id) references public.tenant_members(tenant_id,user_id) on delete cascade
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price numeric(20,2) not null,
  currency text not null default 'USD' check (currency in ('ARS','USD')),
  max_projects integer,
  max_users integer,
  storage_limit_gb numeric(12,3) not null,
  enabled_modules text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
  starts_at date not null default current_date,
  next_due_date date not null,
  ends_at date,
  custom_monthly_price numeric(20,2),
  custom_currency text check (custom_currency in ('ARS','USD')),
  custom_max_projects integer,
  custom_max_users integer,
  custom_storage_limit_gb numeric(12,3),
  custom_enabled_modules text[],
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  setting_key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_entries (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('TENANT','SUPPLIER')),
  tenant_id uuid references public.tenants(id) on delete restrict,
  supplier_id uuid references public.supplier_organizations(id) on delete restrict,
  entry_type text not null check (entry_type in ('SUBSCRIPTION','DIRECT_PURCHASE_FEE','TENDER_FEE','ADJUSTMENT','CREDIT','TAX','PAYMENT')),
  reference_type text,
  reference_id uuid,
  description text not null,
  currency text not null check (currency in ('ARS','USD')),
  net_amount numeric(20,2) not null,
  tax_rate numeric(8,5) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  total_amount numeric(20,2) not null,
  due_date date,
  status text not null default 'PENDING' check (status in ('PENDING','PAID','VOID','OVERDUE')),
  paid_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((party_type='TENANT' and tenant_id is not null and supplier_id is null) or (party_type='SUPPLIER' and supplier_id is not null and tenant_id is null))
);

alter table public.marketplace_service_fees
  add column if not exists payer_type text default 'SUPPLIER' check (payer_type in ('TENANT','SUPPLIER')),
  add column if not exists tax_rate numeric(8,5) not null default 21,
  add column if not exists tax_amount numeric(20,2) not null default 0,
  add column if not exists total_amount numeric(20,2) not null default 0,
  add column if not exists billing_entry_id uuid references public.billing_entries(id) on delete set null;

alter table public.marketplace_service_fees drop constraint if exists marketplace_service_fees_tender_id_supplier_id_currency_key;
create unique index if not exists marketplace_service_fees_tender_payer_unique
on public.marketplace_service_fees(tender_id,payer_type,supplier_id,currency) where tender_id is not null;

create table if not exists public.tenant_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_bytes bigint not null default 0,
  database_bytes bigint not null default 0,
  ai_input_tokens bigint not null default 0,
  ai_output_tokens bigint not null default 0,
  measured_at timestamptz not null default now()
);

create table if not exists public.usage_alert_rules (
  id uuid primary key default gen_random_uuid(),
  metric text not null default 'STORAGE' check (metric in ('STORAGE','DATABASE','AI_TOKENS')),
  threshold_percent numeric(5,2) not null check (threshold_percent > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (metric,threshold_percent)
);

create table if not exists public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('INFO','WARNING','CRITICAL')),
  title text not null,
  message text not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_category text not null check (expense_category in ('SUPABASE','HOSTING','DOMAIN_CERTIFICATES','AI','SMTP','DEVELOPMENT_SUPPORT','MARKETING','TAXES','OTHER_SAAS')),
  supplier_name text,
  description text not null,
  currency text not null check (currency in ('ARS','USD')),
  net_amount numeric(20,2) not null,
  tax_amount numeric(20,2) not null default 0,
  total_amount numeric(20,2) not null,
  expense_date date not null,
  recurring boolean not null default false,
  recurrence text check (recurrence in ('MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL')),
  next_renewal_date date,
  receipt_storage_path text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,description,monthly_price,currency,max_projects,max_users,storage_limit_gb,enabled_modules,sort_order) values
('STARTER','Starter','Plan inicial para constructoras pequeñas',150,'USD',3,5,5,array['projects','treasury','budgets','procurement','marketplace'],10),
('PRO','Pro','Plan para constructoras en crecimiento',250,'USD',5,15,20,array['projects','treasury','budgets','procurement','sales','consortium','ocr','marketplace'],20),
('ENTERPRISE','Enterprise','Plan integral configurable',450,'USD',null,null,100,array['projects','treasury','budgets','procurement','sales','consortium','ocr','marketplace','tenant_settings'],30)
on conflict(code) do update set name=excluded.name,monthly_price=excluded.monthly_price,max_projects=excluded.max_projects,max_users=excluded.max_users,storage_limit_gb=excluded.storage_limit_gb,enabled_modules=excluded.enabled_modules;

insert into public.platform_settings(setting_key,value,description) values
('default_vat_rate','21'::jsonb,'IVA aplicable a suscripciones y comisiones'),
('license_auto_suspend','true'::jsonb,'Suspender automáticamente al día siguiente del vencimiento')
on conflict(setting_key) do nothing;

insert into public.usage_alert_rules(metric,threshold_percent) values ('STORAGE',70),('STORAGE',85),('STORAGE',100)
on conflict(metric,threshold_percent) do nothing;

insert into public.tenant_licenses(tenant_id,plan_id,status,starts_at,next_due_date)
select t.id,p.id,'ACTIVE',current_date,(current_date + interval '1 month')::date
from public.tenants t cross join lateral (select id from public.subscription_plans where code='STARTER') p
on conflict(tenant_id) do nothing;

insert into public.platform_admins(user_id,email,active)
select id,email,true from auth.users where lower(email)=lower('marianoez.gonzalez@gmail.com')
on conflict(email) do update set user_id=excluded.user_id,active=true;

do $$ declare t text; begin
  foreach t in array array['tenant_member_modules','subscription_plans','tenant_licenses','platform_settings','billing_entries','tenant_usage_snapshots','usage_alert_rules','platform_alerts','platform_expenses','platform_audit_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I_platform_admin_all on public.%I',t,t);
    execute format('create policy %I_platform_admin_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',t,t);
  end loop;
end $$;

drop policy if exists tenant_member_modules_tenant_owner on public.tenant_member_modules;
create policy tenant_member_modules_tenant_owner on public.tenant_member_modules for all to authenticated
using (exists(select 1 from public.tenant_members tm where tm.tenant_id=tenant_member_modules.tenant_id and tm.user_id=auth.uid() and tm.active and tm.role in ('owner','admin')))
with check (exists(select 1 from public.tenant_members tm where tm.tenant_id=tenant_member_modules.tenant_id and tm.user_id=auth.uid() and tm.active and tm.role in ('owner','admin')));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('platform-expense-documents','platform-expense-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

commit;
