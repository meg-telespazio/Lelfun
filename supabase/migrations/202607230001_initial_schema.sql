begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  default_currency text not null default 'USD'
    check (default_currency in ('ARS', 'USD', 'BRL')),
  logo_url text,
  phone text,
  legal_address text,
  commercial_address text,
  company_type text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'project_manager', 'accountant', 'member', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT', 'PRE_CONSTRUCTION', 'PLANNING', 'IN_PROGRESS',
      'PAUSED', 'CLOSED', 'DELIVERED', 'WARRANTY'
    )),
  address text,
  city text,
  start_date date,
  planned_end_date date,
  surface_m2 numeric(14,2) not null default 0 check (surface_m2 >= 0),
  sellable_surface_m2 numeric(14,2) not null default 0 check (sellable_surface_m2 >= 0),
  floors integer not null default 1 check (floors >= 0),
  functional_units integer not null default 0 check (functional_units >= 0),
  base_currency text not null default 'USD'
    check (base_currency in ('ARS', 'USD', 'BRL')),
  estimated_cost_per_m2 numeric(18,2) not null default 0 check (estimated_cost_per_m2 >= 0),
  estimated_total_cost numeric(18,2) generated always as
    (round(surface_m2 * estimated_cost_per_m2, 2)) stored,
  physical_progress numeric(5,2) not null default 0
    check (physical_progress between 0 and 100),
  financial_progress numeric(5,2) not null default 0
    check (financial_progress between 0 and 100),
  project_type text,
  construction_type text not null default 'Casa',
  description text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  incidence numeric(7,4) not null default 0 check (incidence between 0 and 100),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.budget_subitems (
  id uuid primary key default gen_random_uuid(),
  budget_line_id uuid not null references public.budget_lines(id) on delete cascade,
  description text not null,
  amount numeric(18,2) not null default 0 check (amount >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  start_week integer not null default 1 check (start_week >= 1),
  end_week integer not null default 1 check (end_week >= start_week),
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_certifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  certification_date date not null default current_date,
  physical_progress numeric(5,2) not null check (physical_progress between 0 and 100),
  financial_progress numeric(5,2) not null check (financial_progress between 0 and 100),
  certified_by text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  bucket_id text not null check (bucket_id in ('project-documents', 'project-images')),
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  document_type text,
  description text,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create index if not exists tenant_members_user_idx
  on public.tenant_members (user_id) where active;
create index if not exists projects_tenant_idx on public.projects (tenant_id);
create index if not exists budget_lines_project_idx on public.budget_lines (project_id, sort_order);
create index if not exists budget_subitems_line_idx on public.budget_subitems (budget_line_id, sort_order);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create index if not exists project_certifications_project_idx
  on public.project_certifications (project_id, certification_date desc);
create index if not exists project_documents_project_idx
  on public.project_documents (project_id, created_at desc);

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists budget_lines_set_updated_at on public.budget_lines;
create trigger budget_lines_set_updated_at
before update on public.budget_lines
for each row execute function public.set_updated_at();

drop trigger if exists budget_subitems_set_updated_at on public.budget_subitems;
create trigger budget_subitems_set_updated_at
before update on public.budget_subitems
for each row execute function public.set_updated_at();

drop trigger if exists project_tasks_set_updated_at on public.project_tasks;
create trigger project_tasks_set_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

create or replace function public.add_tenant_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_members (tenant_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (tenant_id, user_id) do update set role = 'owner', active = true;
  return new;
end;
$$;

drop trigger if exists tenants_add_owner on public.tenants;
create trigger tenants_add_owner
after insert on public.tenants
for each row execute function public.add_tenant_owner();

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.tenant_members
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and active
  );
$$;

create or replace function public.has_tenant_role(target_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.tenant_members
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and active
      and role = any(allowed_roles)
  );
$$;

grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.projects enable row level security;
alter table public.budget_lines enable row level security;
alter table public.budget_subitems enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_certifications enable row level security;
alter table public.project_documents enable row level security;

drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member on public.tenants
for select to authenticated
using (public.is_tenant_member(id) or created_by = auth.uid());

drop policy if exists tenants_insert_authenticated on public.tenants;
create policy tenants_insert_authenticated on public.tenants
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists tenants_update_admin on public.tenants;
create policy tenants_update_admin on public.tenants
for update to authenticated
using (public.has_tenant_role(id, array['owner', 'admin']))
with check (public.has_tenant_role(id, array['owner', 'admin']));

drop policy if exists tenant_members_select_member on public.tenant_members;
create policy tenant_members_select_member on public.tenant_members
for select to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_members_manage_admin on public.tenant_members;
create policy tenant_members_manage_admin on public.tenant_members
for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner', 'admin']))
with check (public.has_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists projects_member_access on public.projects;
create policy projects_member_access on public.projects
for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists budget_lines_member_access on public.budget_lines;
create policy budget_lines_member_access on public.budget_lines
for all to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
);

drop policy if exists budget_subitems_member_access on public.budget_subitems;
create policy budget_subitems_member_access on public.budget_subitems
for all to authenticated
using (
  exists (
    select 1
    from public.budget_lines bl
    join public.projects p on p.id = bl.project_id
    where bl.id = budget_line_id and public.is_tenant_member(p.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.budget_lines bl
    join public.projects p on p.id = bl.project_id
    where bl.id = budget_line_id and public.is_tenant_member(p.tenant_id)
  )
);

drop policy if exists project_tasks_member_access on public.project_tasks;
create policy project_tasks_member_access on public.project_tasks
for all to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
);

drop policy if exists project_certifications_member_access on public.project_certifications;
create policy project_certifications_member_access on public.project_certifications
for all to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
);

drop policy if exists project_documents_member_access on public.project_documents;
create policy project_documents_member_access on public.project_documents
for all to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_tenant_member(p.tenant_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'project-documents',
    'project-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  ),
  (
    'project-images',
    'project-images',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_storage_select on storage.objects;
create policy project_storage_select on storage.objects
for select to authenticated
using (
  bucket_id in ('project-documents', 'project-images')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1 from public.projects p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists project_storage_insert on storage.objects;
create policy project_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('project-documents', 'project-images')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1 from public.projects p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists project_storage_update on storage.objects;
create policy project_storage_update on storage.objects
for update to authenticated
using (
  bucket_id in ('project-documents', 'project-images')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id in ('project-documents', 'project-images')
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists project_storage_delete on storage.objects;
create policy project_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('project-documents', 'project-images')
  and public.has_tenant_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'project_manager']
  )
);

commit;
