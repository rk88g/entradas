insert into public.permission_scopes (
  key,
  module_key,
  scope_type,
  parent_key,
  label,
  description,
  sort_order
)
values
  (
    'listado.captura-menciones',
    null,
    'section',
    'listado',
    'Captura de menciones',
    'Permite capturar y editar peticiones basicas en el pase.',
    43
  ),
  (
    'listado.captura-especiales',
    null,
    'section',
    'listado',
    'Captura de menciones especiales',
    'Permite capturar y editar peticiones especiales en el pase.',
    44
  )
on conflict (key) do update
set
  module_key = excluded.module_key,
  scope_type = excluded.scope_type,
  parent_key = excluded.parent_key,
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true;
