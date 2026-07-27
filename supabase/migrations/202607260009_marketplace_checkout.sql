begin;

alter table public.purchase_requests alter column project_id drop not null;
alter table public.marketplace_direct_requests drop constraint if exists marketplace_direct_requests_status_check;
alter table public.marketplace_direct_requests add constraint marketplace_direct_requests_status_check check (status in ('PENDING','CONFIRMED','CHANGES_PROPOSED','ACCEPTED','REJECTED','CANCELLED','COMPLETED','CLAIMED'));
alter table public.marketplace_direct_requests
  add column if not exists required_date date,
  add column if not exists budget_line_id uuid references public.budget_lines(id) on delete set null,
  add column if not exists purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  add column if not exists confirmed_at timestamptz;

create table if not exists public.marketplace_service_bookings (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null unique references public.marketplace_direct_request_items(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  supplier_id uuid not null references public.supplier_organizations(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  people_count integer not null default 1 check (people_count > 0),
  total_hours numeric(10,2) not null check (total_hours > 0),
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED','COMPLETED','CLAIMED','CANCELLED')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (extract(hour from starts_at at time zone 'America/Argentina/Buenos_Aires') >= 7),
  check (extract(hour from ends_at at time zone 'America/Argentina/Buenos_Aires') <= 19)
);
create index if not exists marketplace_service_booking_availability_idx on public.marketplace_service_bookings(product_id,starts_at,ends_at) where status='CONFIRMED';
alter table public.marketplace_service_bookings enable row level security;

create or replace function public.confirm_marketplace_purchase(
  p_requested_by uuid,
  p_tenant_id uuid,
  p_project_id uuid,
  p_budget_line_id uuid,
  p_delivery_location text,
  p_required_date date,
  p_payment_terms text,
  p_notes text,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_request_id uuid := gen_random_uuid();
  v_purchase_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product marketplace_products%rowtype;
  v_variant marketplace_product_variants%rowtype;
  v_request_item_id uuid;
  v_supplier_id uuid;
  v_currency text;
  v_quantity numeric;
  v_price numeric;
  v_total numeric := 0;
  v_percentage numeric := 1;
  v_fee numeric;
  v_tax numeric;
  v_people integer;
  v_start timestamptz;
  v_end timestamptz;
  v_booked_people integer;
begin
  if not exists(select 1 from tenant_members where tenant_id=p_tenant_id and user_id=p_requested_by and active and role in ('owner','admin','purchasing_manager')) then
    raise exception 'El usuario no está autorizado para comprar por esta organización';
  end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'El carrito está vacío'; end if;
  if p_project_id is not null and not exists(select 1 from projects where id=p_project_id and tenant_id=p_tenant_id) then raise exception 'La obra no pertenece a la organización'; end if;
  if p_budget_line_id is not null and not exists(select 1 from budget_lines bl join projects pr on pr.id=bl.project_id where bl.id=p_budget_line_id and pr.tenant_id=p_tenant_id) then raise exception 'El rubro no pertenece a la organización'; end if;

  select p.* into v_product from marketplace_products p join supplier_organizations s on s.id=p.supplier_id
  where p.id=((p_items->0)->>'productId')::uuid and p.status='ACTIVE' and p.expires_at>now() and s.approval_status='APPROVED' for update of p;
  if not found then raise exception 'La primera publicación ya no está disponible'; end if;
  v_supplier_id := v_product.supplier_id; v_currency := v_product.currency;

  insert into purchase_requests(id,tenant_id,project_id,code,title,status,requested_by,required_date,estimated_total,currency)
  values(v_purchase_id,p_tenant_id,p_project_id,'MP-'||upper(substr(replace(v_purchase_id::text,'-',''),1,10)),'Compra directa Marketplace','ORDERED',p_requested_by::text,p_required_date,0,v_currency);
  insert into marketplace_direct_requests(id,tenant_id,project_id,supplier_id,requested_by,currency,delivery_location,payment_terms,notes,status,required_date,budget_line_id,purchase_request_id,confirmed_at)
  values(v_request_id,p_tenant_id,p_project_id,v_supplier_id,p_requested_by,v_currency,p_delivery_location,p_payment_terms,p_notes,'CONFIRMED',p_required_date,p_budget_line_id,v_purchase_id,now());

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity is null or v_quantity<=0 then raise exception 'Cantidad inválida'; end if;
    select p.* into v_product from marketplace_products p join supplier_organizations s on s.id=p.supplier_id
    where p.id=(v_item->>'productId')::uuid and p.status='ACTIVE' and p.expires_at>now() and s.approval_status='APPROVED' for update of p;
    if not found or v_product.supplier_id<>v_supplier_id then raise exception 'El carrito contiene publicaciones inválidas o de distintos proveedores'; end if;
    if v_product.currency<>v_currency or v_product.price_on_request or v_product.base_price is null then raise exception 'La publicación no admite compra directa'; end if;
    v_price := v_product.base_price;
    if nullif(v_item->>'variantId','') is not null then
      select * into v_variant from marketplace_product_variants where id=(v_item->>'variantId')::uuid and product_id=v_product.id and active for update;
      if not found then raise exception 'Variante no disponible'; end if;
      v_price := coalesce(v_variant.price,v_price);
      if v_variant.stock_quantity is null or v_variant.stock_quantity<v_quantity then raise exception 'Stock insuficiente para la variante'; end if;
      update marketplace_product_variants set stock_quantity=stock_quantity-v_quantity where id=v_variant.id;
    elsif v_product.publication_type='PRODUCT' then
      if v_product.stock_quantity is null or v_product.stock_quantity<v_quantity then raise exception 'Stock insuficiente para %',v_product.name; end if;
      update marketplace_products set stock_quantity=stock_quantity-v_quantity,sold_count=sold_count+ceil(v_quantity)::bigint where id=v_product.id;
    else
      if not v_product.service_available then raise exception 'El servicio no está disponible'; end if;
      v_start := (v_item->>'serviceStart')::timestamptz; v_end := (v_item->>'serviceEnd')::timestamptz; v_people := greatest(1,coalesce((v_item->>'peopleCount')::integer,1));
      if v_start is null or v_end is null or v_end<=v_start then raise exception 'Debe indicar fecha y horario del servicio'; end if;
      select coalesce(sum(people_count),0) into v_booked_people from marketplace_service_bookings where product_id=v_product.id and status='CONFIRMED' and starts_at<v_end and ends_at>v_start;
      if v_booked_people+v_people>coalesce(v_product.service_people_capacity,1) then raise exception 'No hay capacidad disponible en el horario solicitado'; end if;
    end if;
    v_request_item_id := gen_random_uuid();
    insert into marketplace_direct_request_items(id,request_id,product_id,variant_id,quantity,unit_price,notes)
    values(v_request_item_id,v_request_id,v_product.id,nullif(v_item->>'variantId','')::uuid,v_quantity,v_price,v_item->>'notes');
    insert into purchase_items(purchase_request_id,description,quantity,unit,estimated_price,actual_price)
    values(v_purchase_id,v_product.name,v_quantity,v_product.sale_unit,v_price,v_price);
    if v_product.publication_type='SERVICE' then
      insert into marketplace_service_bookings(request_item_id,product_id,supplier_id,starts_at,ends_at,people_count,total_hours)
      values(v_request_item_id,v_product.id,v_supplier_id,v_start,v_end,v_people,extract(epoch from (v_end-v_start))/3600*v_people);
    end if;
    v_total := v_total+(v_quantity*v_price);
  end loop;

  update purchase_requests set estimated_total=v_total where id=v_purchase_id;
  select coalesce(percentage,1) into v_percentage from marketplace_fee_rules where operation_type='DIRECT_PURCHASE' and active and minimum_amount<=v_total and (maximum_amount is null or maximum_amount>v_total) and (currency is null or currency=v_currency) order by minimum_amount desc limit 1;
  v_fee := round(v_total*v_percentage/100,2); v_tax := round(v_fee*0.21,2);
  insert into marketplace_service_fees(operation_type,direct_request_id,tender_id,supplier_id,tenant_id,currency,taxable_amount,percentage,fee_amount,status,calculated_at,payer_type,tax_rate,tax_amount,total_amount)
  values('DIRECT_PURCHASE',v_request_id,null,v_supplier_id,p_tenant_id,v_currency,v_total,v_percentage,v_fee,'PENDING',now(),'SUPPLIER',21,v_tax,v_fee+v_tax);
  insert into marketplace_notifications(user_id,notification_type,title,message,entity_type,entity_id)
  select sm.user_id,'DIRECT_PURCHASE_CONFIRMED','Nueva compra confirmada','Se confirmó una compra por '||v_currency||' '||v_total,'DIRECT_REQUEST',v_request_id from supplier_members sm where sm.supplier_id=v_supplier_id and sm.active;
  return jsonb_build_object('requestId',v_request_id,'purchaseRequestId',v_purchase_id,'total',v_total,'currency',v_currency,'status','CONFIRMED');
end $$;

revoke all on function public.confirm_marketplace_purchase(uuid,uuid,uuid,uuid,text,date,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_marketplace_purchase(uuid,uuid,uuid,uuid,text,date,text,text,jsonb) to service_role;

create policy marketplace_service_bookings_parties on public.marketplace_service_bookings for select to authenticated using (
  public.is_supplier_member(supplier_id) or public.is_platform_admin() or exists(select 1 from marketplace_direct_request_items i join marketplace_direct_requests r on r.id=i.request_id where i.id=request_item_id and public.is_tenant_member(r.tenant_id))
);

commit;
