alter table public.listado
  add column if not exists duplicate_authorized_by uuid references public.user_profiles (id);

drop index if exists public.idx_listado_unique_interno_fecha_activo;

create unique index if not exists idx_listado_unique_interno_fecha_activo
on public.listado (interno_id, fecha_id)
where status <> 'cancelado' and duplicate_authorized_by is null;

insert into public.app_settings (key, value)
values (
  'global_pass_number_counter',
  coalesce(
    (
      select max(l.numero_pase)::text
      from public.listado as l
      where l.numero_pase between 1 and 9999
    ),
    '0'
  )
)
on conflict (key) do nothing;

create or replace function public.reserve_global_pass_numbers(p_count integer)
returns table(sequence_order integer, numero_pase integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_count integer := greatest(coalesce(p_count, 0), 0);
  last_number integer := 0;
  next_number integer := 0;
begin
  if requested_count = 0 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('global_pass_number_counter', 0));

  insert into public.app_settings (key, value)
  values (
    'global_pass_number_counter',
    coalesce(
      (
        select max(l.numero_pase)::text
        from public.listado as l
        where l.numero_pase between 1 and 9999
      ),
      '0'
    )
  )
  on conflict (key) do nothing;

  select coalesce(nullif(s.value, '')::integer, 0)
    into last_number
  from public.app_settings as s
  where s.key = 'global_pass_number_counter'
  for update;

  for sequence_order in 1..requested_count loop
    next_number := case
      when last_number >= 9999 then 1
      else last_number + 1
    end;

    numero_pase := next_number;
    last_number := next_number;
    return next;
  end loop;

  update public.app_settings as s
  set value = last_number::text,
      updated_at = timezone('utc', now())
  where s.key = 'global_pass_number_counter';
end;
$$;

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
  v_fecha_cerrada boolean := false;
  v_assigned_numero integer := p_numero_pase;
begin
  select coalesce(f.cierre, false)
    into v_fecha_cerrada
  from public.fechas as f
  where f.id = p_fecha_id;

  if v_fecha_cerrada and v_assigned_numero is null then
    select reserved.numero_pase
      into v_assigned_numero
    from public.reserve_global_pass_numbers(1) as reserved
    order by reserved.sequence_order
    limit 1;
  end if;

  if v_fecha_cerrada and v_assigned_numero is null then
    raise exception 'No se pudo reservar la numeracion global de pases.';
  end if;

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
    v_assigned_numero,
    v_fecha_cerrada and v_assigned_numero is not null,
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
    join public.module_device_types as types
      on types.id = (item->>'deviceTypeId')::uuid
    cross join lateral generate_series(
      1,
      greatest(1, coalesce((item->>'quantity')::integer, 1))
    ) as qty_row(sequence_no);
  end if;

  return v_pass_id;
end;
$$;
