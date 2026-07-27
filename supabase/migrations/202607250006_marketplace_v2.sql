begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and active
  );
$$;

create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.marketplace_categories(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  tax_id text not null unique,
  company_type text,
  address text,
  city text,
  province text,
  postal_code text,
  phone text,
  contact_email text not null,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  service_areas text[] not null default '{}',
  category_ids uuid[] not null default '{}',
  years_in_business_range text,
  employees_range text,
  annual_revenue_range text,
  company_description text,
  approval_status text not null default 'PENDING' check (approval_status in ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  approval_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_members (
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (supplier_id, user_id),
  unique (user_id)
);

create or replace function public.is_supplier_member(target_supplier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.supplier_members
    where supplier_id = target_supplier and user_id = auth.uid() and active
  );
$$;

create or replace function public.prevent_dual_marketplace_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'supplier_members' and exists (select 1 from public.tenant_members where user_id = new.user_id and active) then
    raise exception 'Un usuario de constructora no puede registrarse como proveedor';
  end if;
  if tg_table_name = 'tenant_members' and exists (select 1 from public.supplier_members where user_id = new.user_id and active) then
    raise exception 'Un usuario proveedor no puede registrarse en una constructora';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_members_no_dual_role on public.supplier_members;
create trigger supplier_members_no_dual_role before insert or update on public.supplier_members
for each row execute function public.prevent_dual_marketplace_membership();
drop trigger if exists tenant_members_no_dual_role on public.tenant_members;
create trigger tenant_members_no_dual_role before insert or update on public.tenant_members
for each row execute function public.prevent_dual_marketplace_membership();

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  document_type text not null,
  title text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  expires_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  category_id uuid not null references public.marketplace_categories(id) on delete restrict,
  name text not null,
  description text not null,
  brand text,
  model text,
  sale_unit text not null,
  currency text not null check (currency in ('ARS','USD')),
  base_price numeric(20,2),
  price_on_request boolean not null default false,
  vat_included boolean not null default false,
  stock_quantity numeric(20,3),
  minimum_quantity numeric(20,3) not null default 1,
  delivery_lead_days integer,
  location text,
  financing_available boolean not null default false,
  financing_details text,
  payment_methods text[] not null default '{}',
  delivery_methods text[] not null default '{}',
  technical_sheet_path text,
  technical_sheet_mime text,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','PAUSED','SUSPENDED','ARCHIVED')),
  suspended_reason text,
  view_count bigint not null default 0,
  published_at timestamptz,
  expires_at timestamptz,
  last_republished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_products
  add column if not exists published_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists last_republished_at timestamptz;

create table if not exists public.marketplace_fee_rules (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('DIRECT_PURCHASE','TENDER_AWARD')),
  minimum_amount numeric(20,2) not null default 0,
  maximum_amount numeric(20,2),
  percentage numeric(8,5) not null check (percentage >= 0 and percentage <= 100),
  currency text check (currency in ('ARS','USD')),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maximum_amount is null or maximum_amount > minimum_amount)
);

create table if not exists public.marketplace_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  sku text,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(20,2),
  stock_quantity numeric(20,3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size <= 2097152),
  sort_order integer not null default 0 check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

create table if not exists public.marketplace_tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  code text not null,
  process_type text not null check (process_type in ('RFI','RFP')),
  visibility text not null check (visibility in ('PUBLIC','PRIVATE','LIMITED')),
  title text not null,
  location text,
  description text not null,
  scope_type text not null check (scope_type in ('MATERIALS','LABOR')),
  delivery_required boolean not null default false,
  budget_amount numeric(20,2),
  budget_currency text check (budget_currency in ('ARS','USD')),
  opening_at timestamptz not null,
  questions_until timestamptz,
  closes_at timestamptz not null,
  award_at timestamptz,
  public_answers boolean not null default true,
  terms_text text,
  required_quote_fields jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','QUESTIONS','CLOSED','EVALUATION','AWARDED','CANCELLED','DESERTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (closes_at > opening_at)
);

create table if not exists public.marketplace_tender_categories (
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  category_id uuid not null references public.marketplace_categories(id) on delete restrict,
  primary key (tender_id, category_id)
);

create table if not exists public.marketplace_tender_invites (
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (tender_id, supplier_id)
);

create table if not exists public.marketplace_tender_requirements (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  label text not null,
  requirement_type text not null check (requirement_type in ('TEXT','NUMBER','DATE','YES_NO','FILE')),
  required boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.marketplace_tender_lines (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  category_id uuid references public.marketplace_categories(id) on delete restrict,
  line_number integer not null,
  description text not null,
  specifications text,
  quantity numeric(20,3) not null,
  unit text not null,
  attachment_paths text[] not null default '{}',
  unique (tender_id, line_number)
);

create table if not exists public.marketplace_tender_questions (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  question text not null,
  answer text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_submissions (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.marketplace_tenders(id) on delete cascade,
  supplier_id uuid not null references public.supplier_organizations(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  requirement_answers jsonb not null default '{}'::jsonb,
  terms_accepted boolean not null,
  terms_accepted_at timestamptz,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','UNDER_EVALUATION','PARTIALLY_AWARDED','AWARDED','NOT_AWARDED')),
  submitted_at timestamptz not null default now(),
  unique (tender_id, supplier_id),
  check (terms_accepted)
);

create table if not exists public.marketplace_submission_lines (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.marketplace_submissions(id) on delete cascade,
  tender_line_id uuid not null references public.marketplace_tender_lines(id) on delete cascade,
  offered boolean not null default true,
  unit_price numeric(20,2),
  currency text check (currency in ('ARS','USD')),
  vat_rate numeric(5,2),
  discount_percent numeric(5,2),
  transport_cost numeric(20,2),
  delivery_days integer,
  validity_days integer,
  payment_terms text,
  notes text,
  unique (submission_id, tender_line_id)
);

create table if not exists public.marketplace_line_awards (
  id uuid primary key default gen_random_uuid(),
  tender_line_id uuid not null unique references public.marketplace_tender_lines(id) on delete cascade,
  submission_line_id uuid not null references public.marketplace_submission_lines(id) on delete restrict,
  awarded_by uuid not null references auth.users(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  notes text
);

create table if not exists public.marketplace_direct_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  supplier_id uuid not null references public.supplier_organizations(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  currency text not null check (currency in ('ARS','USD')),
  delivery_location text,
  payment_terms text,
  notes text,
  status text not null default 'PENDING' check (status in ('PENDING','CHANGES_PROPOSED','ACCEPTED','REJECTED','CANCELLED','COMPLETED')),
  supplier_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_direct_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_direct_requests(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  variant_id uuid references public.marketplace_product_variants(id) on delete restrict,
  quantity numeric(20,3) not null,
  unit_price numeric(20,2),
  proposed_unit_price numeric(20,2),
  notes text
);

create table if not exists public.marketplace_service_fees (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('DIRECT_PURCHASE','TENDER_AWARD')),
  direct_request_id uuid references public.marketplace_direct_requests(id) on delete restrict,
  tender_id uuid references public.marketplace_tenders(id) on delete restrict,
  supplier_id uuid not null references public.supplier_organizations(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  currency text not null check (currency in ('ARS','USD')),
  taxable_amount numeric(20,2) not null,
  percentage numeric(8,5) not null,
  fee_amount numeric(20,2) not null,
  status text not null default 'PENDING' check (status in ('PENDING','INVOICED','PAID','VOID')),
  calculated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (direct_request_id),
  unique (tender_id,supplier_id,currency),
  check ((direct_request_id is not null)::integer + (tender_id is not null)::integer = 1)
);

create table if not exists public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('TENDER','DIRECT_REQUEST')),
  operation_id uuid not null,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_party_type text not null check (reviewer_party_type in ('TENANT','SUPPLIER')),
  reviewed_party_id uuid not null,
  price_rating integer check (price_rating between 1 and 5),
  quality_rating integer check (quality_rating between 1 and 5),
  delivery_rating integer check (delivery_rating between 1 and 5),
  service_rating integer check (service_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (operation_type, operation_id, reviewer_party_type)
);

create table if not exists public.marketplace_complaints (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('TENDER','DIRECT_REQUEST')),
  operation_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  complainant_party_type text not null check (complainant_party_type in ('TENANT','SUPPLIER')),
  complainant_party_id uuid not null,
  respondent_party_id uuid not null,
  subject text not null,
  description text not null,
  status text not null default 'OPEN' check (status in ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')),
  admin_notes text,
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_products_supplier_idx on public.marketplace_products(supplier_id, status);
create index if not exists marketplace_products_category_idx on public.marketplace_products(category_id, status);
create index if not exists marketplace_products_expiry_idx on public.marketplace_products(expires_at) where status = 'ACTIVE';
create index if not exists marketplace_tenders_tenant_status_idx on public.marketplace_tenders(tenant_id, status);
create index if not exists marketplace_tenders_close_idx on public.marketplace_tenders(closes_at) where status in ('PUBLISHED','QUESTIONS');
create index if not exists marketplace_submissions_tender_idx on public.marketplace_submissions(tender_id);
create index if not exists marketplace_notifications_user_idx on public.marketplace_notifications(user_id, read_at, created_at desc);

insert into public.marketplace_categories (code,name,sort_order) values
  ('01','Trabajos preliminares',10),
  ('02','Movimiento de suelos',20),
  ('03','Fundaciones',30),
  ('04','Estructuras',40),
  ('05','Mampostería y tabiques',50),
  ('06','Cubiertas e impermeabilización',60),
  ('07','Instalación sanitaria',70),
  ('08','Instalación eléctrica',80),
  ('09','Instalación de gas',90),
  ('10','Climatización',100),
  ('11','Aberturas y vidrios',110),
  ('12','Pisos y revestimientos',120),
  ('13','Pintura y terminaciones',130),
  ('14','Equipamiento',140),
  ('15','Mano de obra',150),
  ('16','Seguridad e higiene',160),
  ('17','Logística y transporte',170),
  ('18','Servicios profesionales',180)
on conflict (code) do update set name=excluded.name, sort_order=excluded.sort_order;

do $$
declare t text;
begin
  foreach t in array array['marketplace_categories','supplier_organizations','marketplace_products','marketplace_tenders','marketplace_direct_requests','marketplace_complaints'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'platform_admins','marketplace_categories','supplier_organizations','supplier_members','supplier_documents',
    'marketplace_products','marketplace_product_variants','marketplace_product_media','marketplace_tenders',
    'marketplace_tender_categories','marketplace_tender_invites','marketplace_tender_requirements',
    'marketplace_tender_lines','marketplace_tender_questions','marketplace_submissions','marketplace_submission_lines',
    'marketplace_line_awards','marketplace_direct_requests','marketplace_direct_request_items',
    'marketplace_notifications','marketplace_reviews','marketplace_complaints'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table public.marketplace_fee_rules enable row level security;
alter table public.marketplace_service_fees enable row level security;
create policy marketplace_fee_rules_read on public.marketplace_fee_rules for select to authenticated using (active or public.is_platform_admin());
create policy marketplace_fee_rules_admin on public.marketplace_fee_rules for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy marketplace_service_fees_admin on public.marketplace_service_fees for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

insert into public.marketplace_fee_rules (operation_type,minimum_amount,maximum_amount,percentage)
select 'DIRECT_PURCHASE',0,null,1.00000
where not exists (select 1 from public.marketplace_fee_rules where operation_type='DIRECT_PURCHASE' and active);
insert into public.marketplace_fee_rules (operation_type,minimum_amount,maximum_amount,percentage)
select 'TENDER_AWARD',0,null,0.50000
where not exists (select 1 from public.marketplace_fee_rules where operation_type='TENDER_AWARD' and active);

update public.marketplace_products
set published_at = coalesce(published_at, created_at),
    expires_at = coalesce(expires_at, coalesce(published_at, created_at) + interval '30 days')
where status = 'ACTIVE' and expires_at is null;

create policy marketplace_categories_read on public.marketplace_categories for select to authenticated using (active or public.is_platform_admin());
create policy marketplace_categories_admin on public.marketplace_categories for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy supplier_org_authenticated_read on public.supplier_organizations for select to authenticated using (approval_status = 'APPROVED' or public.is_supplier_member(id) or public.is_platform_admin());
create policy supplier_org_member_update on public.supplier_organizations for update to authenticated using (public.is_supplier_member(id)) with check (public.is_supplier_member(id));
create policy supplier_org_admin_all on public.supplier_organizations for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy supplier_members_own_read on public.supplier_members for select to authenticated using (user_id = auth.uid() or public.is_supplier_member(supplier_id) or public.is_platform_admin());
create policy supplier_members_admin on public.supplier_members for all to authenticated using (public.is_supplier_member(supplier_id) or public.is_platform_admin()) with check (public.is_supplier_member(supplier_id) or public.is_platform_admin());

create policy supplier_documents_access on public.supplier_documents for all to authenticated using (public.is_supplier_member(supplier_id) or public.is_platform_admin()) with check (public.is_supplier_member(supplier_id) or public.is_platform_admin());
create policy products_read on public.marketplace_products for select to authenticated using (status = 'ACTIVE' or public.is_supplier_member(supplier_id) or public.is_platform_admin());
create policy products_owner_all on public.marketplace_products for all to authenticated using (public.is_supplier_member(supplier_id) or public.is_platform_admin()) with check (public.is_supplier_member(supplier_id) or public.is_platform_admin());
create policy product_variants_read on public.marketplace_product_variants for select to authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and (p.status='ACTIVE' or public.is_supplier_member(p.supplier_id) or public.is_platform_admin())));
create policy product_variants_write on public.marketplace_product_variants for all to authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and (public.is_supplier_member(p.supplier_id) or public.is_platform_admin()))) with check (exists(select 1 from public.marketplace_products p where p.id=product_id and (public.is_supplier_member(p.supplier_id) or public.is_platform_admin())));
create policy product_media_read on public.marketplace_product_media for select to authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and (p.status='ACTIVE' or public.is_supplier_member(p.supplier_id) or public.is_platform_admin())));
create policy product_media_write on public.marketplace_product_media for all to authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and (public.is_supplier_member(p.supplier_id) or public.is_platform_admin()))) with check (exists(select 1 from public.marketplace_products p where p.id=product_id and (public.is_supplier_member(p.supplier_id) or public.is_platform_admin())));

create policy tenders_tenant_read on public.marketplace_tenders for select to authenticated using (public.is_tenant_member(tenant_id) or public.is_platform_admin() or status <> 'DRAFT');
create policy tenders_tenant_write on public.marketplace_tenders for all to authenticated using (public.is_tenant_member(tenant_id) or public.is_platform_admin()) with check (public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy tender_lines_read on public.marketplace_tender_lines for select to authenticated using (exists(select 1 from public.marketplace_tenders t where t.id=tender_id and (t.status <> 'DRAFT' or public.is_tenant_member(t.tenant_id) or public.is_platform_admin())));
create policy tender_lines_write on public.marketplace_tender_lines for all to authenticated using (exists(select 1 from public.marketplace_tenders t where t.id=tender_id and (public.is_tenant_member(t.tenant_id) or public.is_platform_admin()))) with check (exists(select 1 from public.marketplace_tenders t where t.id=tender_id and (public.is_tenant_member(t.tenant_id) or public.is_platform_admin())));

create policy notifications_own on public.marketplace_notifications for select to authenticated using (user_id=auth.uid() or public.is_platform_admin());
create policy notifications_update_own on public.marketplace_notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy complaints_parties_read on public.marketplace_complaints for select to authenticated using (created_by=auth.uid() or public.is_platform_admin());
create policy complaints_create on public.marketplace_complaints for insert to authenticated with check (created_by=auth.uid());
create policy complaints_admin_update on public.marketplace_complaints for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('marketplace-product-media','marketplace-product-media',false,2097152,array['image/jpeg','image/png','image/webp']),
  ('marketplace-supplier-documents','marketplace-supplier-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
  ('marketplace-tender-documents','marketplace-tender-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists marketplace_storage_authenticated_read on storage.objects;
create policy marketplace_storage_authenticated_read on storage.objects for select to authenticated using (bucket_id in ('marketplace-product-media','marketplace-supplier-documents','marketplace-tender-documents'));
drop policy if exists marketplace_storage_authenticated_insert on storage.objects;
create policy marketplace_storage_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id in ('marketplace-product-media','marketplace-supplier-documents','marketplace-tender-documents'));

-- Seed the initial superadmin when the auth user already exists.
insert into public.platform_admins (user_id,email)
select id,email from auth.users where lower(email)=lower('marianoez.gonzalez@gmail.com')
on conflict (email) do update set user_id=excluded.user_id, active=true;

commit;
