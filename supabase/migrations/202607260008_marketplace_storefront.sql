begin;

alter table public.tenant_members drop constraint if exists tenant_members_role_check;
alter table public.tenant_members add constraint tenant_members_role_check check (role in ('owner','admin','project_manager','accountant','purchasing_manager','member','viewer'));
alter table public.tenants add column if not exists marketplace_validation_status text not null default 'PENDING' check (marketplace_validation_status in ('PENDING','APPROVED','REJECTED','SUSPENDED'));

insert into public.subscription_plans(code,name,description,monthly_price,currency,max_projects,max_users,storage_limit_gb,enabled_modules,sort_order)
values ('MARKETPLACE_BUYER','Comprador Marketplace','Acceso gratuito al Marketplace sin módulos ERP',0,'USD',0,3,1,array['marketplace'],5)
on conflict(code) do update set name=excluded.name,description=excluded.description,monthly_price=excluded.monthly_price,enabled_modules=excluded.enabled_modules;

alter table public.marketplace_products
  add column if not exists publication_type text not null default 'PRODUCT' check (publication_type in ('PRODUCT','SERVICE')),
  add column if not exists sold_count bigint not null default 0,
  add column if not exists service_people_capacity integer,
  add column if not exists service_hours_per_day numeric(6,2),
  add column if not exists service_available boolean not null default true;

alter table public.supplier_organizations
  add column if not exists store_slug text,
  add column if not exists store_logo_path text,
  add column if not exists store_banner_path text,
  add column if not exists identity_verified boolean not null default false,
  add column if not exists completed_operations integer not null default 0,
  add column if not exists average_response_minutes integer;

create unique index if not exists supplier_store_slug_unique on public.supplier_organizations(store_slug) where store_slug is not null;

create table if not exists public.marketplace_featured_memberships (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_organizations(id) on delete cascade,
  billing_cycle text not null check (billing_cycle in ('MONTHLY','ANNUAL')),
  monthly_price numeric(20,2) not null,
  currency text not null default 'USD' check (currency in ('ARS','USD')),
  vat_rate numeric(8,4) not null default 21,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAST_DUE','CANCELLED','EXPIRED','SUSPENDED')),
  starts_at date not null default current_date,
  current_period_end date not null,
  auto_renew boolean not null default true,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_featured_products (
  membership_id uuid not null references public.marketplace_featured_memberships(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (membership_id,product_id)
);

create table if not exists public.marketplace_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_path text,
  background_color text not null default '#0f172a',
  target_type text not null check (target_type in ('CATEGORY','PRODUCT','SUPPLIER')),
  target_id uuid not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  favorite_type text not null check (favorite_type in ('PRODUCT','SUPPLIER')),
  product_id uuid references public.marketplace_products(id) on delete cascade,
  supplier_id uuid references public.supplier_organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((favorite_type='PRODUCT' and product_id is not null and supplier_id is null) or (favorite_type='SUPPLIER' and supplier_id is not null and product_id is null))
);
create unique index if not exists marketplace_favorite_product_unique on public.marketplace_favorites(user_id,product_id) where product_id is not null;
create unique index if not exists marketplace_favorite_supplier_unique on public.marketplace_favorites(user_id,supplier_id) where supplier_id is not null;

create table if not exists public.marketplace_public_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.marketplace_products(id) on delete cascade,
  tender_id uuid references public.marketplace_tenders(id) on delete cascade,
  asked_by uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((product_id is not null)::integer + (tender_id is not null)::integer = 1)
);

insert into public.platform_settings(setting_key,value,description) values
  ('featured_membership_monthly_price','10'::jsonb,'Precio mensual USD de proveedor destacado'),
  ('featured_membership_annual_monthly_price','5'::jsonb,'Precio mensual equivalente del plan anual'),
  ('featured_membership_max_products','10'::jsonb,'Máximo de productos destacados por proveedor'),
  ('featured_membership_vat_rate','21'::jsonb,'IVA de membresía destacada')
on conflict(setting_key) do nothing;

do $$ declare t text; begin
  foreach t in array array['marketplace_featured_memberships','marketplace_featured_products','marketplace_banners','marketplace_favorites','marketplace_public_questions'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

create policy marketplace_banners_public_read on public.marketplace_banners for select to anon,authenticated using (active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
create policy marketplace_banners_admin_all on public.marketplace_banners for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy marketplace_membership_read on public.marketplace_featured_memberships for select to authenticated using (public.is_supplier_member(supplier_id) or public.is_platform_admin());
create policy marketplace_membership_admin on public.marketplace_featured_memberships for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy marketplace_featured_products_read on public.marketplace_featured_products for select to anon,authenticated using (true);
create policy marketplace_featured_products_owner on public.marketplace_featured_products for all to authenticated using (exists(select 1 from public.marketplace_featured_memberships m where m.id=membership_id and (public.is_supplier_member(m.supplier_id) or public.is_platform_admin()))) with check (exists(select 1 from public.marketplace_featured_memberships m where m.id=membership_id and (public.is_supplier_member(m.supplier_id) or public.is_platform_admin())));
create policy marketplace_favorites_own on public.marketplace_favorites for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy marketplace_questions_visible on public.marketplace_public_questions for select to authenticated using (hidden_at is null or public.is_platform_admin());
create policy marketplace_questions_create on public.marketplace_public_questions for insert to authenticated with check (asked_by=auth.uid());
create policy marketplace_questions_moderate on public.marketplace_public_questions for update to authenticated using (public.is_platform_admin() or exists(select 1 from public.marketplace_products p where p.id=product_id and public.is_supplier_member(p.supplier_id))) with check (true);

commit;
