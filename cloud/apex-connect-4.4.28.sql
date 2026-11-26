-- APEX Connect 1.0: text-only internal team chat and direct messages.
-- No inventory, workflow, diagnostics, or existing authorization tables are changed.
-- Run as a single migration on the intended APEX Supabase project only.
create table if not exists public.apex_connect_members (
 user_id uuid primary key references public.apex_staff(user_id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
 updated_at timestamptz not null default now()
);
insert into public.apex_connect_members(user_id,display_name)
 select s.user_id,left(coalesce(nullif(split_part(u.email,'@',1),''),'Team member'),80)
 from public.apex_staff s join auth.users u on u.id=s.user_id
 where s.active = true
on conflict (user_id) do nothing;

create table if not exists public.apex_connect_messages (
 id bigint generated always as identity primary key,
 sender_id uuid not null references public.apex_staff(user_id),
 recipient_id uuid references public.apex_staff(user_id),
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 asset_id text check (asset_id is null or char_length(asset_id) between 1 and 80),
 created_at timestamptz not null default now(),
 constraint apex_connect_no_self_message check (recipient_id is null or recipient_id <> sender_id)
);
create index if not exists apex_connect_team_latest on public.apex_connect_messages(id desc) where recipient_id is null;
create index if not exists apex_connect_direct_outbox on public.apex_connect_messages(sender_id,recipient_id,id desc) where recipient_id is not null;
create index if not exists apex_connect_direct_inbox on public.apex_connect_messages(recipient_id,sender_id,id desc) where recipient_id is not null;

create table if not exists public.apex_connect_reads (
 user_id uuid not null references public.apex_staff(user_id) on delete cascade,
 conversation_key text not null check (conversation_key = 'team' or conversation_key ~ '^dm:[0-9a-f-]{36}$'),
 last_read_id bigint not null default 0 check (last_read_id >= 0),
 updated_at timestamptz not null default now(),
 primary key (user_id,conversation_key)
);

alter table public.apex_connect_members enable row level security;
alter table public.apex_connect_messages enable row level security;
alter table public.apex_connect_reads enable row level security;
revoke all on public.apex_connect_members,public.apex_connect_messages,public.apex_connect_reads from public,anon,authenticated;
grant select,insert,update on public.apex_connect_members to authenticated;
grant select,insert on public.apex_connect_messages to authenticated;
grant select,insert,update on public.apex_connect_reads to authenticated;

-- All permissions require an ACTIVE APEX staff account, not merely a Supabase login.
create policy apex_connect_members_select on public.apex_connect_members for select to authenticated
 using (exists (select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));
create policy apex_connect_members_insert on public.apex_connect_members for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));
create policy apex_connect_members_update on public.apex_connect_members for update to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));

create policy apex_connect_messages_select on public.apex_connect_messages for select to authenticated
 using (exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true)
        and (recipient_id is null or sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy apex_connect_messages_insert on public.apex_connect_messages for insert to authenticated
 with check (sender_id=(select auth.uid())
  and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true)
  and (recipient_id is null or exists(select 1 from public.apex_staff target where target.user_id=recipient_id and target.active=true)));

create policy apex_connect_reads_select on public.apex_connect_reads for select to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));
create policy apex_connect_reads_insert on public.apex_connect_reads for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));
create policy apex_connect_reads_update on public.apex_connect_reads for update to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true));

comment on table public.apex_connect_messages is 'APEX Connect staff messages. Text-only; not an official engineer or refurbishment note.';
