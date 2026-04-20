create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.roles (key, name, description)
values
  ('super-admin', 'Super Admin', 'Administra catálogos, usuarios y permisos'),
  ('control', 'Control', 'Valida ingresos y salidas'),
  ('supervisor', 'Supervisor', 'Revisa, autoriza y supervisa la operación'),
  ('capturador', 'Capturador', 'Registra internos, fechas y pases'),
  ('visual', 'Visual', 'Opera el bloque visual'),
  ('comunicacion', 'Comunicacion', 'Opera el bloque de comunicacion'),
  ('escaleras', 'Escaleras', 'Opera el bloque de escaleras')
on conflict (key) do nothing;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role_id uuid not null references public.roles (id),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internos (
  id uuid primary key default gen_random_uuid(),
  expediente text unique not null,
  nombres text not null,
  apellido_pat text not null,
  apellido_mat text,
  nacimiento date not null,
  llego date not null,
  libre date,
  ubicacion text not null,
  telefono text,
  ubi_filiacion text not null,
  laborando boolean not null default false,
  estatus text not null default 'activo',
  observaciones text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.internos
  add column if not exists telefono text;

alter table public.internos
  alter column ubicacion type text using ubicacion::text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'internos'
      and column_name = 'apartado'
  ) then
    alter table public.internos rename column apartado to laborando;
  end if;
end $$;

alter table public.internos
  drop constraint if exists internos_apartado_check;

alter table public.internos
  drop constraint if exists internos_laborando_check;

alter table public.internos
  add column if not exists laborando boolean not null default false;

alter table public.internos
  alter column laborando type boolean
  using case
    when nullif(trim(laborando::text), '') is null then false
    when lower(trim(laborando::text)) in ('true', 't', '1', 'si', 'activo', '618', 'intima') then true
    else false
  end;

alter table public.internos
  alter column laborando set default false;

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  "nombreCompleto" text not null,
  fecha_nacimiento date not null,
  edad integer not null default 0,
  menor boolean not null default false,
  sexo text not null default 'sin-definir' check (sexo in ('hombre', 'mujer', 'sin-definir')),
  parentesco text not null,
  betada boolean not null default false,
  telefono text,
  notas text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.visitas
  add column if not exists "nombreCompleto" text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visitas'
      and column_name = 'nombres'
  ) then
    execute $sql$
      update public.visitas
      set "nombreCompleto" = trim(
        concat_ws(
          ' ',
          nullif(trim(nombres), ''),
          nullif(trim(apellido_pat), ''),
          nullif(trim(apellido_mat), '')
        )
      )
      where coalesce(trim("nombreCompleto"), '') = ''
    $sql$;
  end if;
end $$;

drop view if exists public.historial_ingresos;

alter table public.visitas
  alter column "nombreCompleto" set not null;

alter table public.visitas
  drop column if exists nombres;

alter table public.visitas
  drop column if exists apellido_pat;

alter table public.visitas
  drop column if exists apellido_mat;

alter table public.visitas
  add column if not exists sexo text not null default 'sin-definir';

alter table public.visitas
  drop constraint if exists visitas_sexo_check;

alter table public.visitas
  add constraint visitas_sexo_check check (sexo in ('hombre', 'mujer', 'sin-definir'));

create or replace function public.set_visita_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.edad := extract(year from age(current_date, new.fecha_nacimiento))::integer;
  new.menor := new.edad < 18;
  return new;
end;
$$;

create table if not exists public.betadas (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid references public.visitas (id) on delete set null,
  nombres text not null,
  apellido_pat text not null,
  apellido_mat text,
  fecha_nacimiento date,
  motivo text not null,
  activo boolean not null default true,
  imposed_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.fechas (
  id uuid primary key default gen_random_uuid(),
  dia smallint not null,
  mes smallint not null,
  anio integer not null,
  fecha_completa date unique not null,
  cierre boolean not null default false,
  estado text not null default 'abierto' check (estado in ('abierto', 'proximo', 'cerrado')),
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listado (
  id uuid primary key default gen_random_uuid(),
  interno_id uuid not null references public.internos (id) on delete cascade,
  fecha_id uuid not null references public.fechas (id) on delete restrict,
  fecha_visita date not null,
  apartado text not null check (apartado in ('618', 'INTIMA')),
  status text not null default 'capturado' check (status in ('capturado', 'autorizado', 'impreso', 'cancelado')),
  numero_pase integer,
  cierre_aplicado boolean not null default false,
  menciones text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.listado
  add column if not exists numero_pase integer;

alter table public.listado
  add column if not exists cierre_aplicado boolean not null default false;

create table if not exists public.interno_visitas (
  id uuid primary key default gen_random_uuid(),
  interno_id uuid not null references public.internos (id) on delete cascade,
  visita_id uuid not null references public.visitas (id) on delete cascade,
  parentesco text,
  titular boolean not null default false,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (interno_id, visita_id)
);

create table if not exists public.visita_interno_historial (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas (id) on delete cascade,
  interno_id uuid not null references public.internos (id) on delete cascade,
  accion text not null default 'reasignacion',
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_by uuid references public.user_profiles (id),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (key, value)
values ('global_cutoff_weekday', '1')
on conflict (key) do nothing;

create table if not exists public.connection_logs (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references public.user_profiles (id) on delete set null,
  email text not null,
  success boolean not null default false,
  failure_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.action_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references public.user_profiles (id) on delete set null,
  module_key text not null,
  section_key text not null,
  action_key text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listado_visitas (
  id uuid primary key default gen_random_uuid(),
  listado_id uuid not null references public.listado (id) on delete cascade,
  visita_id uuid not null references public.visitas (id) on delete restrict,
  orden smallint not null default 1,
  validada boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (listado_id, visita_id)
);

alter table public.user_profiles
  add column if not exists module_only boolean not null default false;

alter table public.listado
  add column if not exists especiales text;

create table if not exists public.block_modules (
  key text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.block_modules (key, name, description)
values
  ('visual', 'Visual', 'Control de aparatos visuales'),
  ('comunicacion', 'Comunicacion', 'Control de aparatos de comunicacion'),
  ('escaleras', 'Escaleras', 'Control de ingreso de mercancia y menciones'),
  ('rentas', 'Rentas', 'Control de rentas')
on conflict (key) do nothing;

create table if not exists public.module_worker_functions (
  key text primary key,
  name text not null
);

insert into public.module_worker_functions (key, name)
values
  ('encargado', 'Encargado'),
  ('segundo', 'Segundo'),
  ('supervisor', 'Supervisor'),
  ('altas', 'Altas'),
  ('cobranza', 'Cobranza'),
  ('mantenimiento', 'Mantenimiento'),
  ('configuracion', 'Configuracion')
on conflict (key) do nothing;

create table if not exists public.module_settings (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  cutoff_weekday smallint not null default 1 check (cutoff_weekday between 0 and 6),
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key)
);

create table if not exists public.module_workers (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  user_profile_id uuid not null references public.user_profiles (id) on delete cascade,
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key, user_profile_id)
);

create table if not exists public.module_worker_permissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.module_workers (id) on delete cascade,
  function_key text not null references public.module_worker_functions (key) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (worker_id, function_key)
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (name)
);

create table if not exists public.module_charge_routes (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  charge_weekday smallint not null check (charge_weekday between 0 and 6),
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key, zone_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'module_zones'
  ) then
    insert into public.zones (name, active, created_by)
    select distinct mz.name, coalesce(mz.active, true), mz.created_by
    from public.module_zones mz
    on conflict (name) do nothing;

    insert into public.module_charge_routes (module_key, zone_id, charge_weekday, active, created_by)
    select
      mz.module_key,
      z.id,
      mz.charge_weekday,
      coalesce(mz.active, true),
      mz.created_by
    from public.module_zones mz
    join public.zones z on z.name = mz.name
    on conflict (module_key, zone_id) do update
    set
      charge_weekday = excluded.charge_weekday,
      active = excluded.active,
      updated_at = timezone('utc', now());
  end if;
end $$;

create table if not exists public.module_device_types (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  key text unique not null,
  name text not null,
  sort_order smallint not null default 0,
  requires_imei boolean not null default false,
  requires_chip boolean not null default false,
  allow_cameras_flag boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.module_device_types (module_key, key, name, sort_order, requires_imei, requires_chip, allow_cameras_flag)
values
  ('comunicacion', 'banda-ancha', 'Banda ancha', 1, false, false, false),
  ('visual', 'consola', 'Consola', 2, false, false, false),
  ('comunicacion', 'celular', 'Celular', 2, true, true, true),
  ('comunicacion', 'internet', 'Internet', 3, false, false, false),
  ('comunicacion', 'laptop', 'Laptop', 4, false, false, true),
  ('visual', 'pantalla', 'Pantalla', 5, false, false, false),
  ('comunicacion', 'satelital', 'Satelital', 8, false, false, false),
  ('visual', 'sonido', 'Sonido', 9, false, false, false),
  ('comunicacion', 'tablet', 'Tablet', 10, false, false, true)
on conflict (key) do update
set
  module_key = excluded.module_key,
  name = excluded.name,
  sort_order = excluded.sort_order,
  requires_imei = excluded.requires_imei,
  requires_chip = excluded.requires_chip,
  allow_cameras_flag = excluded.allow_cameras_flag;

update public.module_device_types
set active = false
where (module_key = 'visual' and name not in ('Pantalla', 'Consola', 'Sonido'))
   or (module_key = 'comunicacion' and name not in ('Banda ancha', 'Celular', 'Internet', 'Laptop', 'Satelital', 'Tablet'));

create table if not exists public.module_prices (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  device_type_id uuid not null references public.module_device_types (id) on delete cascade,
  weekly_price numeric(10,2) not null default 0,
  activation_price numeric(10,2) not null default 0,
  fine_price numeric(10,2) not null default 0,
  maintenance_price numeric(10,2) not null default 0,
  retention_price numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key, device_type_id)
);

alter table public.module_prices
  add column if not exists activation_price numeric(10,2) not null default 0;

alter table public.module_prices
  add column if not exists fine_price numeric(10,2) not null default 0;

alter table public.module_prices
  add column if not exists maintenance_price numeric(10,2) not null default 0;

alter table public.module_prices
  add column if not exists retention_price numeric(10,2) not null default 0;

create table if not exists public.internal_devices (
  id uuid primary key default gen_random_uuid(),
  internal_id uuid not null references public.internos (id) on delete cascade,
  module_key text not null references public.block_modules (key) on delete cascade,
  device_type_id uuid not null references public.module_device_types (id) on delete restrict,
  source_listing_id uuid references public.listado (id) on delete set null,
  zone_id uuid references public.zones (id) on delete set null,
  brand text,
  model text,
  characteristics text,
  imei text,
  chip_number text,
  serial_number text,
  cameras_allowed boolean not null default false,
  quantity integer not null default 1,
  status text not null default 'pendiente' check (status in ('pendiente', 'activo', 'retenido', 'reparacion', 'baja')),
  activated_at timestamptz,
  paid_through date,
  weekly_price_override numeric(10,2),
  discount_override numeric(10,2),
  assigned_manually boolean not null default false,
  notes text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.internal_devices
  add column if not exists activated_at timestamptz;

alter table public.internal_devices
  drop constraint if exists internal_devices_status_check;

alter table public.internal_devices
  add constraint internal_devices_status_check
  check (status in ('pendiente', 'activo', 'retenido', 'reparacion', 'baja'));

create or replace function public.sync_internal_device_module_key()
returns trigger
language plpgsql
as $$
begin
  new.module_key := (
    select t.module_key
    from public.module_device_types t
    where t.id = new.device_type_id
  );

  return new;
end;
$$;

drop trigger if exists internal_devices_sync_module_key on public.internal_devices;
create trigger internal_devices_sync_module_key
before insert or update of device_type_id
on public.internal_devices
for each row
execute function public.sync_internal_device_module_key();

update public.internal_devices d
set module_key = t.module_key
from public.module_device_types t
where t.id = d.device_type_id
  and d.module_key is distinct from t.module_key;

create table if not exists public.workplaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('negocio', 'oficina')),
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workplace_positions (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  title text not null,
  salary numeric(10,2) not null default 0,
  assigned_internal_id uuid references public.internos (id) on delete set null,
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workplace_id, title)
);

create table if not exists public.listing_device_items (
  id uuid primary key default gen_random_uuid(),
  listado_id uuid not null references public.listado (id) on delete cascade,
  device_type_id uuid not null references public.module_device_types (id) on delete restrict,
  quantity integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_payment_cycles (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  week_start date not null,
  week_end date not null,
  closed boolean not null default false,
  closed_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key, week_start, week_end)
);

create table if not exists public.device_payments (
  id uuid primary key default gen_random_uuid(),
  internal_device_id uuid not null references public.internal_devices (id) on delete cascade,
  module_key text not null references public.block_modules (key) on delete cascade,
  zone_id uuid references public.zones (id) on delete set null,
  cycle_id uuid not null references public.device_payment_cycles (id) on delete cascade,
  amount numeric(10,2) not null default 0,
  status text not null default 'pagado' check (status in ('pendiente', 'pagado', 'descuento', 'condonado')),
  paid_at timestamptz,
  paid_by uuid references public.user_profiles (id),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (internal_device_id, cycle_id)
);

create table if not exists public.module_internal_staff (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.block_modules (key) on delete cascade,
  internal_id uuid not null references public.internos (id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles (id) on delete cascade,
  position_key text not null references public.module_worker_functions (key) on delete restrict,
  active boolean not null default true,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_key, internal_id, user_profile_id)
);

create table if not exists public.escalera_entries (
  id uuid primary key default gen_random_uuid(),
  listado_id uuid not null unique references public.listado (id) on delete cascade,
  internal_id uuid not null references public.internos (id) on delete cascade,
  fecha_visita date not null,
  off8_aplica boolean not null default false,
  off8_type text check (off8_type in ('fijo', 'porcentual', 'libre')),
  off8_percent numeric(5,2),
  off8_value numeric(10,2),
  ticket_amount numeric(10,2),
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado', 'entregado', 'pagado', 'retenido', 'rechazado')),
  comentarios text,
  retenciones text,
  confirmed_at timestamptz,
  paid_at timestamptz,
  paid_amount numeric(10,2),
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.escalera_entries
  add column if not exists off8_percent numeric(5,2);

alter table public.escalera_entries
  add column if not exists confirmed_at timestamptz;

alter table public.escalera_entries
  add column if not exists paid_at timestamptz;

alter table public.escalera_entries
  add column if not exists paid_amount numeric(10,2);

alter table public.escalera_entries
  drop constraint if exists escalera_entries_off8_type_check;

alter table public.escalera_entries
  add constraint escalera_entries_off8_type_check
  check (off8_type in ('fijo', 'porcentual', 'libre'));

alter table public.escalera_entries
  drop constraint if exists escalera_entries_status_check;

alter table public.escalera_entries
  add constraint escalera_entries_status_check
  check (status in ('pendiente', 'enviado', 'entregado', 'pagado', 'retenido', 'rechazado'));

create table if not exists public.escalera_entry_items (
  id uuid primary key default gen_random_uuid(),
  escalera_entry_id uuid not null references public.escalera_entries (id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_label text,
  weight_kg numeric(10,2),
  liters numeric(10,2),
  notes text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_log_notes (
  id uuid primary key default gen_random_uuid(),
  internal_id uuid not null references public.internos (id) on delete cascade,
  source_module text not null,
  source_ref_id uuid,
  title text not null,
  notes text not null,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_module, source_ref_id)
);

create table if not exists public.internal_equipment_movements (
  id uuid primary key default gen_random_uuid(),
  internal_id uuid not null references public.internos (id) on delete cascade,
  movement_type text not null check (movement_type in ('venta', 'renta', 'compra', 'cambio')),
  description text not null,
  amount numeric(10,2),
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_fines (
  id uuid primary key default gen_random_uuid(),
  internal_id uuid not null references public.internos (id) on delete cascade,
  concept text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'pagada')),
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_seizures (
  id uuid primary key default gen_random_uuid(),
  internal_id uuid not null references public.internos (id) on delete cascade,
  concept text not null,
  status text not null default 'retenido' check (status in ('retenido', 'entregado', 'cancelado')),
  notes text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop index if exists public.idx_internos_apartado;
create index if not exists idx_internos_laborando on public.internos (laborando);
create index if not exists idx_visitas_betada on public.visitas (betada);
create index if not exists idx_fechas_fecha_completa on public.fechas (fecha_completa);
create index if not exists idx_listado_fecha_visita on public.listado (fecha_visita, apartado);
create index if not exists idx_listado_numero_pase on public.listado (fecha_visita, numero_pase);
create index if not exists idx_interno_visitas_interno on public.interno_visitas (interno_id);
create index if not exists idx_visita_interno_historial_visita on public.visita_interno_historial (visita_id);
create index if not exists idx_internal_devices_module on public.internal_devices (module_key, internal_id);
create index if not exists idx_device_payments_cycle on public.device_payments (module_key, cycle_id);
create index if not exists idx_module_internal_staff_module on public.module_internal_staff (module_key, internal_id);
create index if not exists idx_workplace_positions_internal on public.workplace_positions (assigned_internal_id);
create index if not exists idx_escalera_entries_fecha on public.escalera_entries (fecha_visita, status);
create index if not exists idx_internal_log_notes_internal on public.internal_log_notes (internal_id, created_at desc);
create index if not exists idx_internal_equipment_movements_internal on public.internal_equipment_movements (internal_id, created_at desc);
create index if not exists idx_internal_fines_internal on public.internal_fines (internal_id, created_at desc);
create index if not exists idx_internal_seizures_internal on public.internal_seizures (internal_id, created_at desc);
create index if not exists idx_connection_logs_created_at on public.connection_logs (created_at desc);
create index if not exists idx_action_audit_logs_created_at on public.action_audit_logs (created_at desc);

create or replace view public.historial_ingresos as
select
  l.id as listado_id,
  l.fecha_visita,
  l.apartado,
  l.status,
  i.id as interno_id,
  concat_ws(' ', i.nombres, i.apellido_pat, i.apellido_mat) as interno_nombre,
  v.id as visita_id,
  v."nombreCompleto" as visita_nombre,
  v.parentesco,
  v.edad,
  v.menor,
  v.betada,
  lv.orden
from public.listado l
join public.internos i on i.id = l.interno_id
join public.listado_visitas lv on lv.listado_id = l.id
join public.visitas v on v.id = lv.visita_id;

create or replace function public.sync_visitor_betada()
returns trigger
language plpgsql
as $$
begin
  if new.visita_id is not null then
    update public.visitas
    set betada = new.activo,
        updated_at = timezone('utc', now())
    where id = new.visita_id;
  end if;
  return new;
end;
$$;

drop trigger if exists betadas_sync_visitor on public.betadas;
create trigger betadas_sync_visitor
after insert or update on public.betadas
for each row
execute function public.sync_visitor_betada();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists internos_set_updated_at on public.internos;
create trigger internos_set_updated_at
before update on public.internos
for each row
execute function public.set_updated_at();

drop trigger if exists visitas_set_updated_at on public.visitas;
create trigger visitas_set_updated_at
before update on public.visitas
for each row
execute function public.set_updated_at();

drop trigger if exists visitas_set_derived_fields on public.visitas;
create trigger visitas_set_derived_fields
before insert or update of fecha_nacimiento on public.visitas
for each row
execute function public.set_visita_derived_fields();

drop trigger if exists betadas_set_updated_at on public.betadas;
create trigger betadas_set_updated_at
before update on public.betadas
for each row
execute function public.set_updated_at();

drop trigger if exists fechas_set_updated_at on public.fechas;
create trigger fechas_set_updated_at
before update on public.fechas
for each row
execute function public.set_updated_at();

drop trigger if exists listado_set_updated_at on public.listado;
create trigger listado_set_updated_at
before update on public.listado
for each row
execute function public.set_updated_at();

drop trigger if exists interno_visitas_set_updated_at on public.interno_visitas;
create trigger interno_visitas_set_updated_at
before update on public.interno_visitas
for each row
execute function public.set_updated_at();

drop trigger if exists module_workers_set_updated_at on public.module_workers;
create trigger module_workers_set_updated_at
before update on public.module_workers
for each row
execute function public.set_updated_at();

drop trigger if exists module_settings_set_updated_at on public.module_settings;
create trigger module_settings_set_updated_at
before update on public.module_settings
for each row
execute function public.set_updated_at();

drop trigger if exists zones_set_updated_at on public.zones;
create trigger zones_set_updated_at
before update on public.zones
for each row
execute function public.set_updated_at();

drop trigger if exists module_charge_routes_set_updated_at on public.module_charge_routes;
create trigger module_charge_routes_set_updated_at
before update on public.module_charge_routes
for each row
execute function public.set_updated_at();

drop trigger if exists module_prices_set_updated_at on public.module_prices;
create trigger module_prices_set_updated_at
before update on public.module_prices
for each row
execute function public.set_updated_at();

drop trigger if exists internal_devices_set_updated_at on public.internal_devices;
create trigger internal_devices_set_updated_at
before update on public.internal_devices
for each row
execute function public.set_updated_at();

drop trigger if exists device_payment_cycles_set_updated_at on public.device_payment_cycles;
create trigger device_payment_cycles_set_updated_at
before update on public.device_payment_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists device_payments_set_updated_at on public.device_payments;
create trigger device_payments_set_updated_at
before update on public.device_payments
for each row
execute function public.set_updated_at();

drop trigger if exists module_internal_staff_set_updated_at on public.module_internal_staff;
create trigger module_internal_staff_set_updated_at
before update on public.module_internal_staff
for each row
execute function public.set_updated_at();

drop trigger if exists workplaces_set_updated_at on public.workplaces;
create trigger workplaces_set_updated_at
before update on public.workplaces
for each row
execute function public.set_updated_at();

drop trigger if exists workplace_positions_set_updated_at on public.workplace_positions;
create trigger workplace_positions_set_updated_at
before update on public.workplace_positions
for each row
execute function public.set_updated_at();

drop trigger if exists escalera_entries_set_updated_at on public.escalera_entries;
create trigger escalera_entries_set_updated_at
before update on public.escalera_entries
for each row
execute function public.set_updated_at();

drop trigger if exists escalera_entry_items_set_updated_at on public.escalera_entry_items;
create trigger escalera_entry_items_set_updated_at
before update on public.escalera_entry_items
for each row
execute function public.set_updated_at();

drop trigger if exists internal_log_notes_set_updated_at on public.internal_log_notes;
create trigger internal_log_notes_set_updated_at
before update on public.internal_log_notes
for each row
execute function public.set_updated_at();

drop trigger if exists internal_equipment_movements_set_updated_at on public.internal_equipment_movements;
create trigger internal_equipment_movements_set_updated_at
before update on public.internal_equipment_movements
for each row
execute function public.set_updated_at();

drop trigger if exists internal_fines_set_updated_at on public.internal_fines;
create trigger internal_fines_set_updated_at
before update on public.internal_fines
for each row
execute function public.set_updated_at();

drop trigger if exists internal_seizures_set_updated_at on public.internal_seizures;
create trigger internal_seizures_set_updated_at
before update on public.internal_seizures
for each row
execute function public.set_updated_at();

alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.internos enable row level security;
alter table public.visitas enable row level security;
alter table public.betadas enable row level security;
alter table public.fechas enable row level security;
alter table public.listado enable row level security;
alter table public.listado_visitas enable row level security;
alter table public.interno_visitas enable row level security;
alter table public.visita_interno_historial enable row level security;
alter table public.app_settings enable row level security;
alter table public.connection_logs enable row level security;
alter table public.action_audit_logs enable row level security;
alter table public.block_modules enable row level security;
alter table public.module_settings enable row level security;
alter table public.module_workers enable row level security;
alter table public.module_worker_permissions enable row level security;
alter table public.zones enable row level security;
alter table public.module_charge_routes enable row level security;
alter table public.module_device_types enable row level security;
alter table public.module_prices enable row level security;
alter table public.internal_devices enable row level security;
alter table public.listing_device_items enable row level security;
alter table public.device_payment_cycles enable row level security;
alter table public.device_payments enable row level security;
alter table public.module_internal_staff enable row level security;
alter table public.workplaces enable row level security;
alter table public.workplace_positions enable row level security;
alter table public.escalera_entries enable row level security;
alter table public.escalera_entry_items enable row level security;
alter table public.internal_log_notes enable row level security;
alter table public.internal_equipment_movements enable row level security;
alter table public.internal_fines enable row level security;
alter table public.internal_seizures enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant select on all sequences in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on sequences to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create or replace function public.current_role_key()
returns text
language sql
stable
as $$
  select r.key
  from public.user_profiles up
  join public.roles r on r.id = up.role_id
  where up.id = auth.uid();
$$;

drop policy if exists "read access roles" on public.roles;
create policy "read access roles"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "read own profile" on public.user_profiles;
create policy "read own profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "read access for authenticated users" on public.internos;
create policy "read access for authenticated users"
on public.internos
for select
to authenticated
using (true);

drop policy if exists "read access visitas" on public.visitas;
create policy "read access visitas"
on public.visitas
for select
to authenticated
using (true);

drop policy if exists "read access fechas" on public.fechas;
create policy "read access fechas"
on public.fechas
for select
to authenticated
using (true);

drop policy if exists "read access listado" on public.listado;
create policy "read access listado"
on public.listado
for select
to authenticated
using (true);

drop policy if exists "read access listado_visitas" on public.listado_visitas;
create policy "read access listado_visitas"
on public.listado_visitas
for select
to authenticated
using (true);

drop policy if exists "read access interno_visitas" on public.interno_visitas;
create policy "read access interno_visitas"
on public.interno_visitas
for select
to authenticated
using (true);

drop policy if exists "read access visita_interno_historial" on public.visita_interno_historial;
create policy "read access visita_interno_historial"
on public.visita_interno_historial
for select
to authenticated
using (true);

drop policy if exists "read access app_settings" on public.app_settings;
create policy "read access app_settings"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "read access connection logs" on public.connection_logs;
create policy "read access connection logs"
on public.connection_logs
for select
to authenticated
using (public.current_role_key() = 'super-admin');

drop policy if exists "read access audit logs" on public.action_audit_logs;
create policy "read access audit logs"
on public.action_audit_logs
for select
to authenticated
using (public.current_role_key() = 'super-admin');

drop policy if exists "read access betadas" on public.betadas;
create policy "read access betadas"
on public.betadas
for select
to authenticated
using (true);

drop policy if exists "manage internals by control roles" on public.internos;
create policy "manage internals by control roles"
on public.internos
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'));

drop policy if exists "manage visitors by control roles" on public.visitas;
create policy "manage visitors by control roles"
on public.visitas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'));

drop policy if exists "manage dates by privileged roles" on public.fechas;
create policy "manage dates by privileged roles"
on public.fechas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor'));

drop policy if exists "manage pass list by control roles" on public.listado;
create policy "manage pass list by control roles"
on public.listado
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'));

drop policy if exists "manage pass visitors by control roles" on public.listado_visitas;
create policy "manage pass visitors by control roles"
on public.listado_visitas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'));

drop policy if exists "manage internal visitors by control roles" on public.interno_visitas;
create policy "manage internal visitors by control roles"
on public.interno_visitas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor', 'capturador'));

drop policy if exists "manage visitor transfer history" on public.visita_interno_historial;
create policy "manage visitor transfer history"
on public.visita_interno_historial
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control'))
with check (public.current_role_key() in ('super-admin', 'control'));

drop policy if exists "manage app settings" on public.app_settings;
create policy "manage app settings"
on public.app_settings
for all
to authenticated
using (public.current_role_key() = 'super-admin')
with check (public.current_role_key() = 'super-admin');

drop policy if exists "manage connection logs" on public.connection_logs;
create policy "manage connection logs"
on public.connection_logs
for all
to authenticated
using (public.current_role_key() = 'super-admin')
with check (public.current_role_key() = 'super-admin');

drop policy if exists "manage audit logs" on public.action_audit_logs;
create policy "manage audit logs"
on public.action_audit_logs
for all
to authenticated
using (public.current_role_key() = 'super-admin')
with check (public.current_role_key() = 'super-admin');

drop policy if exists "manage betadas by privileged roles" on public.betadas;
create policy "manage betadas by privileged roles"
on public.betadas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor'));

drop policy if exists "read access block_modules" on public.block_modules;
create policy "read access block_modules"
on public.block_modules
for select
to authenticated
using (true);

drop policy if exists "read access module workers" on public.module_workers;
create policy "read access module workers"
on public.module_workers
for select
to authenticated
using (true);

drop policy if exists "read access module settings" on public.module_settings;
create policy "read access module settings"
on public.module_settings
for select
to authenticated
using (true);

drop policy if exists "read access module worker permissions" on public.module_worker_permissions;
create policy "read access module worker permissions"
on public.module_worker_permissions
for select
to authenticated
using (true);

drop policy if exists "read access zones" on public.zones;
create policy "read access zones"
on public.zones
for select
to authenticated
using (true);

drop policy if exists "read access module charge routes" on public.module_charge_routes;
create policy "read access module charge routes"
on public.module_charge_routes
for select
to authenticated
using (true);

drop policy if exists "read access module device types" on public.module_device_types;
create policy "read access module device types"
on public.module_device_types
for select
to authenticated
using (true);

drop policy if exists "read access module prices" on public.module_prices;
create policy "read access module prices"
on public.module_prices
for select
to authenticated
using (true);

drop policy if exists "read access internal devices" on public.internal_devices;
create policy "read access internal devices"
on public.internal_devices
for select
to authenticated
using (true);

drop policy if exists "read access listing device items" on public.listing_device_items;
create policy "read access listing device items"
on public.listing_device_items
for select
to authenticated
using (true);

drop policy if exists "read access payment cycles" on public.device_payment_cycles;
create policy "read access payment cycles"
on public.device_payment_cycles
for select
to authenticated
using (true);

drop policy if exists "read access device payments" on public.device_payments;
create policy "read access device payments"
on public.device_payments
for select
to authenticated
using (true);

drop policy if exists "read access module internal staff" on public.module_internal_staff;
create policy "read access module internal staff"
on public.module_internal_staff
for select
to authenticated
using (true);

drop policy if exists "read access escalera entries" on public.escalera_entries;
create policy "read access escalera entries"
on public.escalera_entries
for select
to authenticated
using (true);

drop policy if exists "read access escalera entry items" on public.escalera_entry_items;
create policy "read access escalera entry items"
on public.escalera_entry_items
for select
to authenticated
using (true);

drop policy if exists "read access internal log notes" on public.internal_log_notes;
create policy "read access internal log notes"
on public.internal_log_notes
for select
to authenticated
using (true);

drop policy if exists "read access internal equipment movements" on public.internal_equipment_movements;
create policy "read access internal equipment movements"
on public.internal_equipment_movements
for select
to authenticated
using (true);

drop policy if exists "read access internal fines" on public.internal_fines;
create policy "read access internal fines"
on public.internal_fines
for select
to authenticated
using (true);

drop policy if exists "read access internal seizures" on public.internal_seizures;
create policy "read access internal seizures"
on public.internal_seizures
for select
to authenticated
using (true);

drop policy if exists "read access workplaces" on public.workplaces;
create policy "read access workplaces"
on public.workplaces
for select
to authenticated
using (true);

drop policy if exists "read access workplace positions" on public.workplace_positions;
create policy "read access workplace positions"
on public.workplace_positions
for select
to authenticated
using (true);

drop policy if exists "manage modules by authenticated users" on public.module_workers;
create policy "manage modules by authenticated users"
on public.module_workers
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage module settings by authenticated users" on public.module_settings;
create policy "manage module settings by authenticated users"
on public.module_settings
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage module worker permissions by authenticated users" on public.module_worker_permissions;
create policy "manage module worker permissions by authenticated users"
on public.module_worker_permissions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage zones by authenticated users" on public.zones;
create policy "manage zones by authenticated users"
on public.zones
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage module charge routes by authenticated users" on public.module_charge_routes;
create policy "manage module charge routes by authenticated users"
on public.module_charge_routes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage module prices by authenticated users" on public.module_prices;
create policy "manage module prices by authenticated users"
on public.module_prices
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage internal devices by authenticated users" on public.internal_devices;
create policy "manage internal devices by authenticated users"
on public.internal_devices
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage listing device items by authenticated users" on public.listing_device_items;
create policy "manage listing device items by authenticated users"
on public.listing_device_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage payment cycles by authenticated users" on public.device_payment_cycles;
create policy "manage payment cycles by authenticated users"
on public.device_payment_cycles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage device payments by authenticated users" on public.device_payments;
create policy "manage device payments by authenticated users"
on public.device_payments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage module internal staff by authenticated users" on public.module_internal_staff;
create policy "manage module internal staff by authenticated users"
on public.module_internal_staff
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage workplaces by authenticated users" on public.workplaces;
create policy "manage workplaces by authenticated users"
on public.workplaces
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage workplace positions by authenticated users" on public.workplace_positions;
create policy "manage workplace positions by authenticated users"
on public.workplace_positions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage escalera entries by authenticated users" on public.escalera_entries;
create policy "manage escalera entries by authenticated users"
on public.escalera_entries
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage escalera entry items by authenticated users" on public.escalera_entry_items;
create policy "manage escalera entry items by authenticated users"
on public.escalera_entry_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage internal log notes by authenticated users" on public.internal_log_notes;
create policy "manage internal log notes by authenticated users"
on public.internal_log_notes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage internal equipment movements by authenticated users" on public.internal_equipment_movements;
create policy "manage internal equipment movements by authenticated users"
on public.internal_equipment_movements
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage internal fines by authenticated users" on public.internal_fines;
create policy "manage internal fines by authenticated users"
on public.internal_fines
for all
to authenticated
using (true)
with check (true);

drop policy if exists "manage internal seizures by authenticated users" on public.internal_seizures;
create policy "manage internal seizures by authenticated users"
on public.internal_seizures
for all
to authenticated
using (true)
with check (true);
