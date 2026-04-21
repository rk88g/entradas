alter table public.zones
  add column if not exists sort_order integer;

with ordered as (
  select
    id,
    row_number() over (order by name asc, created_at asc, id asc) as next_sort_order
  from public.zones
)
update public.zones z
set sort_order = ordered.next_sort_order
from ordered
where z.id = ordered.id
  and z.sort_order is null;

alter table public.zones
  alter column sort_order set default 1;

update public.zones
set sort_order = 1
where sort_order is null;

alter table public.zones
  alter column sort_order set not null;

create index if not exists idx_zones_sort_order
  on public.zones (sort_order asc, name asc);
