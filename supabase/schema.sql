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
  ('capturador', 'Capturador', 'Registra internos, fechas y pases')
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
  ubicacion integer not null,
  ubi_filiacion text not null,
  apartado text not null check (apartado in ('618', 'INTIMA')),
  estatus text not null default 'activo',
  observaciones text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellido_pat text not null,
  apellido_mat text,
  fecha_nacimiento date not null,
  edad integer generated always as (
    extract(year from age(current_date, fecha_nacimiento))::integer
  ) stored,
  menor boolean generated always as (
    extract(year from age(current_date, fecha_nacimiento)) < 18
  ) stored,
  parentesco text not null,
  betada boolean not null default false,
  telefono text,
  notas text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  menciones text,
  created_by uuid references public.user_profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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

create index if not exists idx_internos_apartado on public.internos (apartado);
create index if not exists idx_visitas_betada on public.visitas (betada);
create index if not exists idx_fechas_fecha_completa on public.fechas (fecha_completa);
create index if not exists idx_listado_fecha_visita on public.listado (fecha_visita, apartado);

create or replace view public.historial_ingresos as
select
  l.id as listado_id,
  l.fecha_visita,
  l.apartado,
  l.status,
  i.id as interno_id,
  concat_ws(' ', i.nombres, i.apellido_pat, i.apellido_mat) as interno_nombre,
  v.id as visita_id,
  concat_ws(' ', v.nombres, v.apellido_pat, v.apellido_mat) as visita_nombre,
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

alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.internos enable row level security;
alter table public.visitas enable row level security;
alter table public.betadas enable row level security;
alter table public.fechas enable row level security;
alter table public.listado enable row level security;
alter table public.listado_visitas enable row level security;

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

drop policy if exists "manage betadas by privileged roles" on public.betadas;
create policy "manage betadas by privileged roles"
on public.betadas
for all
to authenticated
using (public.current_role_key() in ('super-admin', 'control', 'supervisor'))
with check (public.current_role_key() in ('super-admin', 'control', 'supervisor'));

