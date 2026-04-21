create or replace function public.ensure_single_super_admin()
returns trigger
language plpgsql
as $$
declare
  v_super_admin_role_id uuid;
  v_existing_super_admin_id uuid;
begin
  select id
  into v_super_admin_role_id
  from public.roles
  where key = 'super-admin'
  limit 1;

  if v_super_admin_role_id is null then
    return new;
  end if;

  if new.role_id = v_super_admin_role_id then
    select id
    into v_existing_super_admin_id
    from public.user_profiles
    where role_id = v_super_admin_role_id
      and id <> coalesce(new.id, gen_random_uuid())
    limit 1;

    if v_existing_super_admin_id is not null then
      raise exception 'Solo puede existir un usuario con rol super-admin.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_single_super_admin_on_user_profiles on public.user_profiles;
create trigger ensure_single_super_admin_on_user_profiles
before insert or update of role_id on public.user_profiles
for each row
execute function public.ensure_single_super_admin();
