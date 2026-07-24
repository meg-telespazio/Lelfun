# Supabase setup

Run the migrations in this order from the Supabase SQL Editor:

1. `migrations/202607230001_initial_schema.sql`
2. `migrations/202607240002_sales_crm_and_storage.sql`
3. `migrations/202607240003_operational_backend.sql`

The migration creates:

- multi-tenant companies and memberships;
- projects;
- budget lines and subitems;
- project schedules;
- progress certifications;
- document metadata;
- private `project-documents` and `project-images` buckets;
- row-level security policies for authenticated tenant members.

Storage objects must use this path convention:

`{tenant_id}/{project_id}/{generated_file_name}`

Both IDs are UUIDs. Files are private and should be downloaded with signed URLs.

## Sales CRM storage

The second migration creates these private buckets automatically:

- `sales-media`: unit photos, plans and renders (20 MB per file).
- `sales-documents`: reservations, offers, contracts and receipts (50 MB per file).

Sales objects must use this path convention:

`{tenant_id}/{project_id}/{entity_type}/{entity_id}/{generated_file_name}`

Examples:

- `{tenant_id}/{project_id}/unidad/{unit_id}/frente.webp`
- `{tenant_id}/{project_id}/oportunidad/{opportunity_id}/reserva.pdf`
- `{tenant_id}/{project_id}/contrato/{contract_id}/contrato-firmado.pdf`

Do not make these buckets public. Use authenticated uploads and signed URLs for
private downloads. The migration includes the RLS policies for tenant members.

Reservation expiry can be executed with:

```sql
select public.expire_sales_reservations();
```

For automatic expiry, schedule that statement from Supabase Cron once per hour.
