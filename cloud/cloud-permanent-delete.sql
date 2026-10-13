-- Step 6.2: run this entire SQL file once in the Supabase SQL Editor.
-- Keep the existing cloud-permanent-delete.sql function and add authoritative tombstones.
-- Back up your Supabase database first. This does not delete any existing devices.
create table if not exists public.apex_deleted_assets (
 id text primary key,
 deleted_at timestamptz not null default now(),
 deleted_by uuid
);
alter table public.apex_deleted_assets enable row level security;
revoke all on public.apex_deleted_assets from public,anon,authenticated;
-- Only the server-side bridge's secret/service-role credential can read tombstones.
-- Stop stale API writes (including the Hub sync bridge) from recreating deleted IDs.
create or replace function public.apex_block_recreated_deleted_asset()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.apex_deleted_assets where id=upper(btrim(new.id))) then
  raise exception 'This asset was permanently deleted and cannot be recreated through intake or sync' using errcode='23505';
 end if;
 return new;
end $$;
drop trigger if exists apex_prevent_deleted_recreate on public.apex_assets;
create trigger apex_prevent_deleted_recreate before insert on public.apex_assets
for each row execute function public.apex_block_recreated_deleted_asset();

-- APEX Patch 05: administrator-only permanent cloud asset deletion.
-- Run once in Supabase SQL Editor AFTER making a database backup.
-- Deletes only the requested asset and its linked refurbishment job/order lines.
-- Audit trail and intake receipts are intentionally retained.
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
 insert into public.apex_deleted_assets(id,deleted_at,deleted_by)
 values(asset_id,now(),auth.uid()) on conflict(id) do nothing;
 delete from public.apex_assets where id=asset_id;
 return jsonb_build_object('ok',true,'deleted',asset_id);
end $$;
revoke all on function public.apex_hard_delete_asset(text,bigint) from public,anon;
grant execute on function public.apex_hard_delete_asset(text,bigint) to authenticated;
