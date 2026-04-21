alter table public.visitas
  add column if not exists fecha_betada date;

alter table public.betadas
  add column if not exists fecha_betada date;

update public.visitas
set fecha_betada = coalesce(fecha_betada, current_date)
where betada = true
  and fecha_betada is null;

update public.betadas
set fecha_betada = coalesce(fecha_betada, created_at::date, current_date)
where activo = true
  and fecha_betada is null;

create or replace function public.sync_visitor_betada()
returns trigger
language plpgsql
as $$
begin
  if new.visita_id is not null then
    update public.visitas
    set betada = new.activo,
        fecha_betada = case
          when new.activo then coalesce(new.fecha_betada, current_date)
          else null
        end,
        updated_at = timezone('utc', now())
    where id = new.visita_id;
  end if;
  return new;
end;
$$;
