insert into public.permission_scopes (
  key,
  module_key,
  scope_type,
  parent_key,
  label,
  description,
  sort_order
)
values (
  'listado.fechas-historicas',
  null,
  'section',
  'listado',
  'Fechas historicas',
  'Permite elegir fechas pasadas y futuras disponibles dentro del modulo Listado.',
  43
)
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = timezone('utc', now());
