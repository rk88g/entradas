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
