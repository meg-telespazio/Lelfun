begin;

alter table public.financial_accounts
  add column if not exists responsible_name text,
  add column if not exists responsible_email text,
  add column if not exists responsible_phone text;

comment on column public.financial_accounts.responsible_name is
  'Nombre y apellido del usuario responsable de una caja de efectivo o caja de seguridad.';
comment on column public.financial_accounts.responsible_email is
  'Correo del usuario del tenant asignado como responsable.';
comment on column public.financial_accounts.responsible_phone is
  'Teléfono de contacto del responsable de la caja.';

commit;
