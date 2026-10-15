-- Permanent cloud deletion. Existing installations should run hub-diagnostics-reentry.sql once.
begin;
create table if not exists public.apex_deleted_assets(id text primary key,deleted_at timestamptz not null default now(),deleted_by uuid);
alter table public.apex_deleted_assets enable row level security;
revoke all on public.apex_deleted_assets from public,anon,authenticated;
alter table public.apex_deleted_assets
 add column if not exists deleted_revision bigint,
 add column if not exists re_registered_at timestamptz,
 add column if not exists reentry_event_id text;

-- A transaction-scoped permit, issued only by the validated Diagnostics RPC.
-- Application clients and sync bridges cannot create or read these permits.
create table if not exists public.apex_diagnostic_reentry_permits (
 asset_id text not null,
 transaction_id bigint not null,
 actor uuid not null,
 primary key(asset_id,transaction_id)
);
alter table public.apex_diagnostic_reentry_permits enable row level security;
revoke all on public.apex_diagnostic_reentry_permits from public,anon,authenticated;
alter table public.apex_diagnostic_reentry_permits alter column actor drop not null;
alter table public.apex_device_intake_receipts alter column actor drop not null;

create or replace function public.apex_block_recreated_deleted_asset()
returns trigger language plpgsql security definer set search_path='' as $$
declare deletion public.apex_deleted_assets;
 authorised_id text;
 last_revision bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('apex-intake-asset:'||upper(btrim(new.id)),0));
 select * into deletion from public.apex_deleted_assets where id=upper(btrim(new.id));
 if found then
  delete from public.apex_diagnostic_reentry_permits
   where asset_id=upper(btrim(new.id))
    and transaction_id=txid_current() and actor is not distinct from auth.uid()
   returning asset_id into authorised_id;
  if authorised_id is null then
   raise exception 'This asset was deleted. Submit a new Diagnostics report to register it again.' using errcode='23505';
  end if;
  -- Keep revisions above the previous device incarnation. Stale Studio updates
  -- cannot match a newly registered device merely because it has the same tag.
  select coalesce(max(revision),0) into last_revision
   from public.apex_audit where asset_id=upper(btrim(new.id));
  new.revision:=greatest(last_revision,coalesce(deletion.deleted_revision,0))+1;
 end if;
 return new;
end $$;
-- This name sorts after apex_asset_change, which initializes normal new revisions.
drop trigger if exists apex_prevent_deleted_recreate on public.apex_assets;
create trigger apex_prevent_deleted_recreate before insert on public.apex_assets
for each row execute function public.apex_block_recreated_deleted_asset();

create or replace function public.apex_hard_delete_asset(p_id text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 asset_row public.apex_assets;
 workflow_row public.apex_refurb_workflow;
 document_next jsonb;
 jobs_next jsonb;
 orders_next jsonb;
 audit_next jsonb;
 asset_id text;
begin
 asset_id:=upper(btrim(coalesce(p_id,'')));
 if auth.uid() is null or not exists(
   select 1 from public.apex_staff where user_id=auth.uid() and active=true and role='admin'
 ) then
  raise exception 'Only an active APEX administrator can permanently delete a cloud laptop' using errcode='42501';
 end if;
 if asset_id='' or p_expected_revision is null then
  raise exception 'Asset ID and expected revision are required' using errcode='22023';
 end if;
 -- Serialise deletion with first-time intake and re-registration of the same tag.
 perform pg_advisory_xact_lock(hashtextextended('apex-intake-asset:'||asset_id,0));
 -- Lock the asset before the workflow, matching device intake's lock order.
 select * into asset_row from public.apex_assets where id=asset_id for update;
 if not found then raise exception 'Laptop not found. Refresh inventory.' using errcode='P0002'; end if;
 if asset_row.revision<>p_expected_revision then
  raise exception 'Laptop changed on another PC. Refresh before deleting.' using errcode='40001';
 end if;
 select * into workflow_row from public.apex_refurb_workflow where singleton_id=1 for update;
 if not found then raise exception 'Refurbishment workflow unavailable; no records deleted.'; end if;
 document_next:=workflow_row.document;
 jobs_next:=coalesce(document_next->'jobs','{}'::jsonb) - asset_id;
 select coalesce(jsonb_agg(
    jsonb_set(o.value,'{lines}',
     (select coalesce(jsonb_agg(l.value order by l.ordinality),'[]'::jsonb)
      from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) with ordinality as l(value,ordinality)
      where l.value->>'assetId' is distinct from asset_id),true)
    order by o.ordinality),'[]'::jsonb)
 into orders_next
 from jsonb_array_elements(coalesce(document_next->'orders','[]'::jsonb)) with ordinality as o(value,ordinality)
 where exists (select 1 from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) as l(value)
    where l.value->>'assetId' is distinct from asset_id);
 audit_next:=jsonb_build_array(jsonb_build_object(
  'id',gen_random_uuid()::text,'type','Asset permanently deleted',
  'at',now()::text,'assetId',asset_id,
  'detail','Administrator removed asset and its linked job and purchase-order lines.',
  'by','Administrator')) || coalesce(document_next->'audit','[]'::jsonb);
 if jsonb_array_length(audit_next)>2500 then
  select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
   into audit_next from jsonb_array_elements(audit_next) with ordinality as x(value,ordinality)
   where x.ordinality<=2500;
 end if;
 document_next:=jsonb_set(document_next,'{jobs}',jobs_next,true);
 document_next:=jsonb_set(document_next,'{orders}',orders_next,true);
 document_next:=jsonb_set(document_next,'{audit}',audit_next,true);
 update public.apex_refurb_workflow
  set document=document_next,revision=revision+1,updated_at=now(),updated_by=auth.uid()
  where singleton_id=1;
 -- Write a permanent deletion marker in the same database transaction.
 -- If the transaction fails, neither operation is committed.
 insert into public.apex_deleted_assets(id,deleted_at,deleted_by,deleted_revision,re_registered_at,reentry_event_id)
 values(asset_id,clock_timestamp(),auth.uid(),asset_row.revision,null,null)
 on conflict(id) do update set deleted_at=excluded.deleted_at,deleted_by=excluded.deleted_by,
  deleted_revision=excluded.deleted_revision,re_registered_at=null,reentry_event_id=null;
 delete from public.apex_assets where id=asset_id;
 return jsonb_build_object('ok',true,'deleted',asset_id);
end $$;
revoke all on function public.apex_hard_delete_asset(text,bigint) from public,anon;
grant execute on function public.apex_hard_delete_asset(text,bigint) to authenticated;

commit;
