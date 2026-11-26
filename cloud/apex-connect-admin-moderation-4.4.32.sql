-- APEX Connect 1.3: administrators can remove messages visible in their own
-- conversations and clear a selected conversation for its participants.
-- No change to regular staff's sender-only delete policy.
-- No direct DELETE privileges are expanded to users.
create schema if not exists apex_connect_private;
revoke all on schema apex_connect_private from public,anon;
create table if not exists apex_connect_private.admin_deletion_audit(
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null check(action in ('message','conversation')),
  conversation_kind text check(conversation_kind in ('team','direct')),
  other_user uuid,
  message_id bigint,
  deleted_count integer not null default 0 check(deleted_count>=0),
  performed_at timestamptz not null default now()
);
revoke all on apex_connect_private.admin_deletion_audit from public,anon,authenticated;

create or replace function public.apex_connect_admin_delete_message(p_message_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare actor_id uuid := auth.uid(); removed_count integer:=0;
begin
 if actor_id is null or not exists(
   select 1 from public.apex_staff s
   where s.user_id=actor_id and s.active and s.role='admin'
 ) then raise exception 'APEX cloud administrator required' using errcode='42501'; end if;
 if p_message_id is null or p_message_id < 1 then
   raise exception 'Valid message id required' using errcode='22023';
 end if;
 -- Admin can only moderate messages in Office Team or conversations they are part of.
 delete from public.apex_connect_messages m
 where m.id=p_message_id
   and (m.recipient_id is null or m.sender_id=actor_id or m.recipient_id=actor_id);
 get diagnostics removed_count=row_count;
 if removed_count<>1 then
   raise exception 'Message not found in your accessible conversations' using errcode='22023';
 end if;
 insert into apex_connect_private.admin_deletion_audit(actor,action,message_id,deleted_count)
 values(actor_id,'message',p_message_id,removed_count);
 return jsonb_build_object('ok',true,'deleted',removed_count,'deletedId',p_message_id);
end;
$$;

create or replace function public.apex_connect_admin_delete_conversation(
  p_kind text,
  p_other_user uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare actor_id uuid := auth.uid(); removed_count integer:=0;
begin
 if actor_id is null or not exists(
   select 1 from public.apex_staff s
   where s.user_id=actor_id and s.active and s.role='admin'
 ) then raise exception 'APEX cloud administrator required' using errcode='42501'; end if;
 if p_kind not in ('team','direct') or p_kind is null then
   raise exception 'Select an Office Team or direct conversation' using errcode='22023';
 end if;
 if p_kind='team' then
   if p_other_user is not null then
     raise exception 'Team conversation must not specify a colleague' using errcode='22023';
   end if;
   delete from public.apex_connect_messages m where m.recipient_id is null;
 else
   if p_other_user is null or p_other_user=actor_id or not exists(
      select 1 from public.apex_staff s where s.user_id=p_other_user
   ) then raise exception 'Select a valid colleague' using errcode='22023'; end if;
   -- Clear ONLY the direct thread between this admin and the selected colleague.
   -- Other staff conversations are never affected.
   delete from public.apex_connect_messages m
   where (m.sender_id=actor_id and m.recipient_id=p_other_user)
      or (m.sender_id=p_other_user and m.recipient_id=actor_id);
 end if;
 get diagnostics removed_count=row_count;
 insert into apex_connect_private.admin_deletion_audit(actor,action,conversation_kind,other_user,deleted_count)
 values(actor_id,'conversation',p_kind,p_other_user,removed_count);
 return jsonb_build_object('ok',true,'deleted',removed_count,'conversation',p_kind);
end;
$$;

revoke all on function public.apex_connect_admin_delete_message(bigint) from public,anon;
revoke all on function public.apex_connect_admin_delete_conversation(text,uuid) from public,anon;
grant execute on function public.apex_connect_admin_delete_message(bigint) to authenticated;
grant execute on function public.apex_connect_admin_delete_conversation(text,uuid) to authenticated;
