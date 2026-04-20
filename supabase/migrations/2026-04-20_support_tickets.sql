create extension if not exists "pgcrypto";

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.user_profiles (id) on delete cascade,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  subject text not null,
  type text not null check (type in ('cambio', 'correccion', 'solicitud', 'comentario')),
  status text not null default 'abierto' check (
    status in (
      'abierto',
      'en platicas',
      'en autorizacion',
      'no autorizado',
      'escribiendo codigo',
      'pruebas',
      'realizado',
      'cerrado'
    )
  ),
  context_snapshot jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_user_id uuid not null references public.user_profiles (id) on delete cascade,
  body text not null,
  read_by_recipient_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by, last_message_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, last_message_at desc);
create index if not exists idx_support_messages_ticket on public.support_messages (ticket_id, created_at asc);
create index if not exists idx_support_messages_unread on public.support_messages (ticket_id, read_by_recipient_at, sender_user_id);

create or replace function public.sync_support_ticket_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set
    last_message_at = new.created_at,
    updated_at = timezone('utc', now())
  where id = new.ticket_id;

  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row
execute function public.set_updated_at();

drop trigger if exists support_messages_sync_ticket on public.support_messages;
create trigger support_messages_sync_ticket
after insert on public.support_messages
for each row
execute function public.sync_support_ticket_last_message();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "read support tickets" on public.support_tickets;
create policy "read support tickets"
on public.support_tickets
for select
to authenticated
using (
  public.current_role_key() = 'super-admin'
  or created_by = auth.uid()
);

drop policy if exists "insert support tickets" on public.support_tickets;
create policy "insert support tickets"
on public.support_tickets
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "update support tickets" on public.support_tickets;
create policy "update support tickets"
on public.support_tickets
for update
to authenticated
using (
  public.current_role_key() = 'super-admin'
  or created_by = auth.uid()
)
with check (
  public.current_role_key() = 'super-admin'
  or created_by = auth.uid()
);

drop policy if exists "read support messages" on public.support_messages;
create policy "read support messages"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        public.current_role_key() = 'super-admin'
        or t.created_by = auth.uid()
      )
  )
);

drop policy if exists "insert support messages" on public.support_messages;
create policy "insert support messages"
on public.support_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        public.current_role_key() = 'super-admin'
        or t.created_by = auth.uid()
      )
  )
);

drop policy if exists "update support messages" on public.support_messages;
create policy "update support messages"
on public.support_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        public.current_role_key() = 'super-admin'
        or t.created_by = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        public.current_role_key() = 'super-admin'
        or t.created_by = auth.uid()
      )
  )
);

insert into public.permission_scopes (key, module_key, scope_type, parent_key, label, description, sort_order)
values
  ('tickets', null, 'module', null, 'Tickets', 'Tickets y chat con super-admin', 35),
  ('tickets.chat', null, 'section', 'tickets', 'Chat', 'Chat del ticket activo', 36)
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.support_tickets;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.support_messages;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
