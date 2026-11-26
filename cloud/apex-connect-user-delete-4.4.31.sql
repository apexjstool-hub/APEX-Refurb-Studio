-- APEX Connect 4.4.31: delete your own sent chat message for everyone.
-- No broad deletion of received messages or any inventory/technical records.
grant delete on public.apex_connect_messages to authenticated;
drop policy if exists apex_connect_messages_sender_delete on public.apex_connect_messages;
create policy apex_connect_messages_sender_delete on public.apex_connect_messages
 for delete to authenticated
 using (sender_id=(select auth.uid()) and exists(
  select 1 from public.apex_staff s where s.user_id=(select auth.uid()) and s.active=true
 ));
