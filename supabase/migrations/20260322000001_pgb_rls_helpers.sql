-- ============================================================
-- PGB Portaal — RLS helpers + signup triggers + chat tables
-- Builds on top of existing zorgmaatje schema
-- owner_id pattern: budgethouder IS de tenant (auth.uid())
-- ============================================================

-- Helper: get the owner_id for the current user
-- For beheerder: returns their own auth.uid()
-- For zorgverlener: returns the owner_id from team_members
create or replace function my_owner_id()
returns uuid language sql stable security definer as $$
  select coalesce(
    -- If current user is directly an owner (beheerder)
    (select auth.uid() where exists (
      select 1 from team_members
      where owner_id = auth.uid() and member_user_id = auth.uid()
    )),
    -- Otherwise find the owner through team_members
    (select owner_id from team_members
     where member_user_id = auth.uid() and status = 'actief'
     limit 1),
    -- Fallback: user is their own owner (new beheerder)
    auth.uid()
  )
$$;

-- Helper: get the role of the current user
create or replace function my_pgb_role()
returns text language sql stable security definer as $$
  select coalesce(
    (select rol from team_members
     where member_user_id = auth.uid() and status = 'actief'
     limit 1),
    'beheerder'
  )
$$;

-- ============================================================
-- CONVERSATIONS & MESSAGES (nieuw voor chat)
-- ============================================================

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text,
  type        text not null default 'group' check (type in ('group', 'direct')),
  created_at  timestamptz not null default now()
);
create unique index if not exists conversations_owner_group_idx
  on conversations(owner_id) where type = 'group';

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  body            text not null,
  is_deleted      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx
  on messages(conversation_id, created_at desc);

-- ============================================================
-- RLS op alle tabellen
-- ============================================================

-- team_members
alter table team_members enable row level security;
create policy "team_members: beheerder alles" on team_members
  for all using (owner_id = auth.uid());
create policy "team_members: zorgverlener eigen rij" on team_members
  for select using (member_user_id = auth.uid());

-- planning
alter table planning enable row level security;
create policy "planning: beheerder alles" on planning
  for all using (owner_id = auth.uid());
create policy "planning: zorgverlener eigen diensten" on planning
  for select using (
    team_member_id in (
      select id from team_members where member_user_id = auth.uid()
    )
  );
create policy "planning: zorgverlener eigen status update" on planning
  for update using (
    team_member_id in (
      select id from team_members where member_user_id = auth.uid()
    )
  );

-- taken
alter table taken enable row level security;
create policy "taken: beheerder alles" on taken
  for all using (owner_id = auth.uid());
create policy "taken: zorgverlener lezen" on taken
  for select using (my_owner_id() = owner_id);

-- taken_afvinkingen
alter table taken_afvinkingen enable row level security;
create policy "taken_afvinkingen: beheerder alles" on taken_afvinkingen
  for all using (owner_id = auth.uid());
create policy "taken_afvinkingen: zorgverlener eigen" on taken_afvinkingen
  for all using (
    afgevinkt_door in (
      select id from team_members where member_user_id = auth.uid()
    )
  );

-- berichten (bestaande chat tabel)
alter table berichten enable row level security;
create policy "berichten: zelfde owner" on berichten
  for all using (owner_id = my_owner_id());

-- conversations
alter table conversations enable row level security;
create policy "conversations: zelfde owner" on conversations
  for all using (owner_id = my_owner_id());

-- conversation_members
alter table conversation_members enable row level security;
create policy "conversation_members: zelfde owner" on conversation_members
  for all using (
    conversation_id in (
      select id from conversations where owner_id = my_owner_id()
    )
  );

-- messages
alter table messages enable row level security;
create policy "messages: zelfde owner" on messages
  for all using (owner_id = my_owner_id());

-- profiles
alter table profiles enable row level security;
create policy "profiles: eigen profiel" on profiles
  for all using (user_id = auth.uid());

-- ============================================================
-- TRIGGER: maak groepsgesprek aan bij nieuwe beheerder signup
-- ============================================================

create or replace function handle_new_user_conversation()
returns trigger language plpgsql security definer as $$
begin
  -- Alleen voor nieuwe beheerders (geen bestaand team_member record)
  if not exists (
    select 1 from team_members where member_user_id = new.id
  ) then
    -- Maak een groepsgesprek aan voor deze nieuwe beheerder
    insert into conversations (owner_id, name, type)
    values (new.id, 'Teamchat', 'group')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Trigger op profiles (wordt aangemaakt na user signup)
create or replace trigger on_profile_created_make_conversation
  after insert on profiles
  for each row execute procedure handle_new_user_conversation();
