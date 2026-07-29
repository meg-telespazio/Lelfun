-- Tareas jerárquicas y certificaciones asociadas a avances de obra.
alter table public.project_tasks
  add column if not exists parent_task_id uuid
  references public.project_tasks(id) on delete cascade;

create index if not exists project_tasks_parent_idx
  on public.project_tasks (parent_task_id, sort_order);

alter table public.project_certifications
  add column if not exists task_id uuid
  references public.project_tasks(id) on delete restrict,
  add column if not exists amount numeric(18,2)
  check (amount is null or amount >= 0),
  add column if not exists invoice_number text,
  add column if not exists receipt_number text;

create index if not exists project_certifications_task_idx
  on public.project_certifications (task_id, certification_date desc);

comment on column public.project_certifications.task_id is
  'Nullable solamente para certificaciones históricas previas a esta migración; las nuevas lo requieren desde la API.';
