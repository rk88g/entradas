create extension if not exists "pgcrypto";

create schema if not exists legacy;

create table if not exists legacy.interno (
  id integer primary key,
  nombre text,
  apellido text,
  fecha_ingreso timestamp,
  ubicacion integer,
  created_at timestamp,
  updated_at timestamp
);

create table if not exists legacy.visita (
  id integer primary key,
  id_interno integer,
  "nombreCompleto" text,
  parentezco text,
  edad integer,
  genero text,
  betado integer,
  created_at timestamp,
  updated_at timestamp
);

create table if not exists public.legacy_interno_map (
  old_interno_id integer primary key,
  new_interno_id uuid not null unique,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legacy_visita_map (
  old_visita_id integer primary key,
  old_interno_id integer,
  new_visita_id uuid not null unique,
  new_interno_id uuid not null,
  imported_at timestamptz not null default timezone('utc', now())
);

drop table if exists tmp_legacy_internos_transform;

create temporary table tmp_legacy_internos_transform as
with internos_validos as (
  select
    i.id as old_interno_id,
    gen_random_uuid() as new_interno_id,
    trim(i.nombre) as nombres,
    split_part(trim(coalesce(i.apellido, '')), ' ', 1) as apellido_pat,
    nullif(
      trim(
        substr(
          trim(coalesce(i.apellido, '')),
          length(split_part(trim(coalesce(i.apellido, '')), ' ', 1)) + 1
        )
      ),
      ''
    ) as apellido_mat,
    case
      when char_length(trim(i.ubicacion::text)) = 3 then
        substr(trim(i.ubicacion::text), 1, 1) || '-' || substr(trim(i.ubicacion::text), 2, 2)
      when char_length(trim(i.ubicacion::text)) = 4 then
        substr(trim(i.ubicacion::text), 1, 2) || '-' || substr(trim(i.ubicacion::text), 3, 2)
      else null
    end as ubicacion_normalizada,
    i.fecha_ingreso::date as llego,
    coalesce(i.created_at, now()) as created_at,
    coalesce(i.updated_at, now()) as updated_at
  from legacy.interno i
),
internos_filtrados as (
  select *
  from internos_validos
  where ubicacion_normalizada is not null
)
select *
from internos_filtrados;

insert into public.legacy_interno_map (old_interno_id, new_interno_id)
select old_interno_id, new_interno_id
from tmp_legacy_internos_transform
on conflict (old_interno_id) do update
set new_interno_id = excluded.new_interno_id;

insert into public.internos (
  id,
  expediente,
  nombres,
  apellido_pat,
  apellido_mat,
  nacimiento,
  llego,
  libre,
  ubicacion,
  telefono,
  ubi_filiacion,
  laborando,
  estatus,
  observaciones,
  created_at,
  updated_at
)
select
  m.new_interno_id,
  'LEGACY-INT-' || i.old_interno_id,
  i.nombres,
  i.apellido_pat,
  i.apellido_mat,
  i.llego,
  i.llego,
  null,
  i.ubicacion_normalizada,
  null,
  'Importacion legacy',
  false,
  'activo',
  null,
  i.created_at,
  i.updated_at
from (
  select
    old_interno_id,
    nombres,
    apellido_pat,
    apellido_mat,
    ubicacion_normalizada,
    coalesce(llego, current_date) as llego,
    created_at,
    updated_at
  from tmp_legacy_internos_transform
) i
join public.legacy_interno_map m on m.old_interno_id = i.old_interno_id
on conflict (id) do update
set
  nombres = excluded.nombres,
  apellido_pat = excluded.apellido_pat,
  apellido_mat = excluded.apellido_mat,
  llego = excluded.llego,
  ubicacion = excluded.ubicacion,
  laborando = false,
  updated_at = excluded.updated_at;

drop table if exists tmp_legacy_visitas_transform;

create temporary table tmp_legacy_visitas_transform as
with visitas_validas as (
  select
    v.id as old_visita_id,
    v.id_interno as old_interno_id,
    gen_random_uuid() as new_visita_id,
    m.new_interno_id,
    trim(v."nombreCompleto") as "nombreCompleto",
    trim(coalesce(v.parentezco, 'Sin dato')) as parentesco,
    make_date(
      extract(year from current_date)::int - greatest(coalesce(v.edad, 0), 0),
      1,
      1
    ) as fecha_nacimiento,
    case upper(trim(coalesce(v.genero, '')))
      when 'H' then 'hombre'
      when 'M' then 'mujer'
      else 'sin-definir'
    end as sexo,
    case
      when coalesce(v.betado, 0) = 1 then true
      else false
    end as betada,
    coalesce(v.created_at, now()) as created_at,
    coalesce(v.updated_at, now()) as updated_at
  from legacy.visita v
  join public.legacy_interno_map m on m.old_interno_id = v.id_interno
  where coalesce(trim(v."nombreCompleto"), '') <> ''
)
select *
from visitas_validas;

insert into public.legacy_visita_map (
  old_visita_id,
  old_interno_id,
  new_visita_id,
  new_interno_id
)
select
  old_visita_id,
  old_interno_id,
  new_visita_id,
  new_interno_id
from tmp_legacy_visitas_transform
on conflict (old_visita_id) do update
set
  old_interno_id = excluded.old_interno_id,
  new_visita_id = excluded.new_visita_id,
  new_interno_id = excluded.new_interno_id;

insert into public.visitas (
  id,
  "nombreCompleto",
  fecha_nacimiento,
  sexo,
  parentesco,
  betada,
  telefono,
  notas,
  created_at,
  updated_at
)
select
  v.new_visita_id,
  v."nombreCompleto",
  v.fecha_nacimiento,
  v.sexo,
  v.parentesco,
  v.betada,
  'No aplica',
  null,
  v.created_at,
  v.updated_at
from (
  select
    old_visita_id,
    old_interno_id,
    new_visita_id,
    new_interno_id,
    "nombreCompleto",
    fecha_nacimiento,
    sexo,
    parentesco,
    betada,
    created_at,
    updated_at
  from tmp_legacy_visitas_transform
) v
on conflict (id) do update
set
  "nombreCompleto" = excluded."nombreCompleto",
  fecha_nacimiento = excluded.fecha_nacimiento,
  sexo = excluded.sexo,
  parentesco = excluded.parentesco,
  betada = excluded.betada,
  telefono = 'No aplica',
  updated_at = excluded.updated_at;

insert into public.interno_visitas (
  interno_id,
  visita_id,
  parentesco,
  titular,
  created_at,
  updated_at
)
select
  m.new_interno_id,
  m.new_visita_id,
  v.parentezco,
  false,
  coalesce(v.created_at, now()),
  coalesce(v.updated_at, now())
from public.legacy_visita_map m
join legacy.visita v on v.id = m.old_visita_id
on conflict (interno_id, visita_id) do update
set
  parentesco = excluded.parentesco,
  updated_at = excluded.updated_at;
