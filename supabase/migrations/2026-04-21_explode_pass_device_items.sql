create or replace function public.create_support_pass(
  p_interno_id uuid,
  p_fecha_id uuid,
  p_fecha_visita date,
  p_created_by uuid,
  p_numero_pase integer,
  p_menciones text,
  p_especiales text,
  p_visitor_ids uuid[],
  p_device_items jsonb default '[]'::jsonb,
  p_duplicate_authorized_by uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_pass_id uuid;
begin
  insert into public.listado (
    interno_id,
    fecha_id,
    fecha_visita,
    apartado,
    status,
    numero_pase,
    cierre_aplicado,
    menciones,
    especiales,
    created_by,
    duplicate_authorized_by
  )
  values (
    p_interno_id,
    p_fecha_id,
    p_fecha_visita,
    '618',
    'capturado',
    p_numero_pase,
    false,
    p_menciones,
    p_especiales,
    p_created_by,
    p_duplicate_authorized_by
  )
  returning id into v_pass_id;

  insert into public.listado_visitas (listado_id, visita_id, orden, validada)
  select
    v_pass_id,
    visitor_id,
    ordinality::smallint,
    false
  from unnest(p_visitor_ids) with ordinality as visitor_rows(visitor_id, ordinality);

  if jsonb_typeof(coalesce(p_device_items, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_device_items, '[]'::jsonb)) > 0 then
    insert into public.listing_device_items (listado_id, device_type_id, quantity)
    select
      v_pass_id,
      (item->>'deviceTypeId')::uuid,
      1
    from jsonb_array_elements(p_device_items) as item
    cross join lateral generate_series(
      1,
      greatest(1, coalesce((item->>'quantity')::integer, 1))
    ) as qty_row(sequence_no);

    insert into public.internal_devices (
      internal_id,
      module_key,
      device_type_id,
      source_listing_id,
      quantity,
      cameras_allowed,
      status,
      created_by
    )
    select
      p_interno_id,
      types.module_key,
      types.id,
      v_pass_id,
      1,
      false,
      'pendiente',
      p_created_by
    from jsonb_array_elements(p_device_items) as item
    join public.module_device_types types
      on types.id = (item->>'deviceTypeId')::uuid
    cross join lateral generate_series(
      1,
      greatest(1, coalesce((item->>'quantity')::integer, 1))
    ) as qty_row(sequence_no);
  end if;

  return v_pass_id;
end;
$$;
