-- APEX Connect 1.1: fix direct-message sends rejected by apex_staff self-only RLS.
-- A sender may only send to another *active* APEX staff member.
-- Keep recipient and sender private message RLS unchanged.
-- This narrowly scoped helper lives outside Supabase's exposed public schema.
begin;
create schema if not exists apex_connect_private;
revoke all on schema apex_connect_private from public, anon;
grant usage on schema apex_connect_private to authenticated;

create or replace function apex_connect_private.can_send_to(p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
 select
  auth.uid() is not null
  and exists (
    select 1 from public.apex_staff as sender
    where sender.user_id = auth.uid() and sender.active is true
  )
  and (
    p_recipient is null
    or exists (
      select 1 from public.apex_staff as recipient
      where recipient.user_id = p_recipient and recipient.active is true
    )
  );
$$;
revoke all on function apex_connect_private.can_send_to(uuid) from public, anon;
grant execute on function apex_connect_private.can_send_to(uuid) to authenticated;

drop policy if exists apex_connect_messages_insert on public.apex_connect_messages;
create policy apex_connect_messages_insert
on public.apex_connect_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and apex_connect_private.can_send_to(recipient_id)
);

-- No access to other staff profiles, or unrelated direct messages, is granted.
-- The original SELECT policies and message data remain unchanged.
commit;
