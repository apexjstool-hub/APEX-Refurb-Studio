-- APEX: Diagnostics re-entry through both direct cloud and the trusted hub.
-- Run this complete file once. Requires the Management Studio hub update v4.0.44 or later.
-- Run this complete file ONCE in Supabase > SQL Editor.
-- Direct cloud re-entry remains supported. No per-device unblocking is needed.
-- Existing inventory, staff accounts, reports and deletion markers are preserved.
begin;

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

create or replace function public.apex_receive_device_intake(
 p_source text,p_event_id text,p_asset_id text,p_report jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare rec public.apex_assets;
 previous public.apex_device_intake_receipts;
 next_payload jsonb;
 specs jsonb;
 lookup jsonb;
 report_key text;
 asset_tag text;
 model_name text;
 field_name text;
 incoming text;
 existing_value text;
 job jsonb;
 jobs jsonb;
 parts jsonb;
 requirement jsonb;
 inspection_part jsonb;
 part_name text;
 part_count integer;
 part_key text;
 workflow_doc jsonb;
 created boolean:=false;
 reentry boolean:=false;
 test_name text;
 test_status text;
 test_doc jsonb;
begin
 if not public.apex_is_staff() and not (p_source='diagnostics' and coalesce(auth.role(),'')='service_role') then raise exception 'Staff authorisation required' using errcode='42501';end if;
 asset_tag:=upper(btrim(coalesce(p_asset_id,'')));
 if p_source is null or p_source not in ('diagnostics','refurbflow') or p_event_id is null
  or length(p_event_id) not between 12 and 120 or p_event_id !~ '^[A-Za-z0-9_.:-]+$'
  or length(asset_tag) not between 2 and 80 or asset_tag !~ '^[A-Z0-9][A-Z0-9 _./:-]*$'
  or p_report is null or jsonb_typeof(p_report)<>'object'
  or pg_column_size(p_report)>262144
 then raise exception 'Invalid device intake' using errcode='22023'; end if;
 if upper(btrim(coalesce(p_report->>'assetId',p_report->>'id','')))<>asset_tag
 then raise exception 'Report asset ID mismatch' using errcode='22023'; end if;
 -- Same Asset ID is serialized, including concurrent first-time registrations.
 perform pg_advisory_xact_lock(hashtextextended('apex-intake-asset:'||asset_tag,0));
 perform pg_advisory_xact_lock(hashtextextended('apex-intake-event:'||p_source||':'||p_event_id,0));
 select * into previous from public.apex_device_intake_receipts
 where source=p_source and event_id=p_event_id;
 if found then
  if previous.asset_id<>asset_tag then raise exception 'Event reused for another asset' using errcode='23505';end if;
  return jsonb_build_object('ok',true,'duplicate',true,'created',false,'assetId',asset_tag);
 end if;
 select * into rec from public.apex_assets where public.apex_assets.id=asset_tag for update;
 if not found then
  -- RefurbFlow only adds inspection/repair data to laptops first registered by Diagnostics or Studio.
  if p_source='refurbflow' then
   raise exception 'Asset not registered. Send Diagnostics first or register this laptop in Studio.' using errcode='P0002';
  end if;
  -- A new diagnostics report must provide at least a model, or a readable device name.
  specs:=case when jsonb_typeof(p_report->'specs')='object' then p_report->'specs' else '{}'::jsonb end;
  model_name:=nullif(btrim(coalesce(p_report->>'model',specs->>'model',p_report->>'deviceModel',p_report->>'fullModel','')),'');
  if model_name is null then model_name:='Model not detected';end if;
  next_payload:=jsonb_build_object('id',asset_tag,'model',left(model_name,140),
   'manufacturer',left(coalesce(p_report->>'manufacturer',specs->>'manufacturer',''),90),
   'serial',left(coalesce(p_report->>'serial',p_report->>'serialNumber',specs->>'serial',''),90),
   'productType','Laptop','status','Awaiting Processing','condition','Not assessed',
   'location','Unassigned','pallet','',
   'createdAt',now(),'updatedAt',now(),
   'history',jsonb_build_array(jsonb_build_object('type','Intake','detail','Automatically registered from '||p_source,'at',now())));
  -- A new, staff-authorised Diagnostics event can re-register this tag.
  -- Previously accepted events return above and never get a re-entry permit.
  if exists(select 1 from public.apex_deleted_assets where id=asset_tag) then
   insert into public.apex_diagnostic_reentry_permits(asset_id,transaction_id,actor)
    values(asset_tag,txid_current(),auth.uid());
   reentry:=true;
   next_payload:=jsonb_set(next_payload,'{history}',
    next_payload->'history'||jsonb_build_array(jsonb_build_object(
     'type','Re-registered','detail','Registered again from a new Diagnostics submission after deletion.',
     'at',now())),true);
  end if;
  insert into public.apex_assets(id,payload) values(asset_tag,next_payload) returning * into rec;
  if reentry then
   update public.apex_deleted_assets
    set re_registered_at=clock_timestamp(),reentry_event_id=p_event_id where id=asset_tag;
  end if;
  created:=true;
 else
  if rec.payload->>'deletedAt' is not null then raise exception 'Archived laptop cannot accept reports' using errcode='22023';end if;
  next_payload:=rec.payload;
 end if;
 -- Fill hardware fields when provided by Diagnostics. Never clear an existing field with blanks.
 -- Other inventory data (manual notes, locations, parts, refurb, history) remains unchanged.
 if p_source='diagnostics' then
  specs:=case when jsonb_typeof(p_report->'specs')='object' then p_report->'specs' else '{}'::jsonb end;
  for field_name in select unnest(array['model','manufacturer','serial','processor','gpu','ram','storage','operatingSystem']) loop
   incoming:=nullif(btrim(coalesce(p_report->>field_name,specs->>field_name,
     case field_name when 'serial' then p_report->>'serialNumber' when 'operatingSystem' then p_report->>'windowsVersion' else null end,'')),'');
   if incoming is not null then
    existing_value:=nullif(btrim(coalesce(next_payload->>field_name,'')),'');
    -- Preserve a user's existing model when diagnostics only supplies a placeholder.
    if not (field_name='model' and incoming='Model not detected' and existing_value is not null) then
     next_payload:=jsonb_set(next_payload,array[field_name],to_jsonb(left(incoming,140)),true);
    end if;
   end if;
  end loop;
 end if;
 if p_source='diagnostics' and jsonb_typeof(p_report->'tests')='object' then
  test_doc:='{}'::jsonb;
  for test_name in select unnest(array['display','touchscreen','keyboard','pointer','audio','microphone','camera','wifi','bluetooth','battery','physical','system','hardware','health','gauntlet','advanced']) loop
   test_status:=lower(coalesce(p_report->'tests'->test_name->>'status',p_report->'tests'->>test_name,''));
   if test_status in ('pass','fail') then
    test_doc:=test_doc||jsonb_build_object(test_name,jsonb_build_object('status',test_status,'source','APEX Diagnostics'));
   end if;
  end loop;
  if test_doc<>'{}'::jsonb then
   next_payload:=jsonb_set(next_payload,'{diagnosticTests}',coalesce(next_payload->'diagnosticTests','{}'::jsonb)||test_doc,true);
  end if;
 end if;
 report_key:=case when p_source='diagnostics' then 'diagnosticsIntake' else 'refurbflowIntake' end;
 lookup:=case when jsonb_typeof(next_payload->report_key)='array' then next_payload->report_key else '[]'::jsonb end;
 -- Preserve the latest 49 previous events and append the new one.
 next_payload:=jsonb_set(next_payload,array[report_key],
  coalesce((select jsonb_agg(e.value order by e.ordinality)
     from jsonb_array_elements(lookup) with ordinality as e(value,ordinality)
     where e.ordinality>greatest(0,jsonb_array_length(lookup)-49)),'[]'::jsonb)
   ||jsonb_build_array(jsonb_build_object('eventId',p_event_id,'receivedAt',now(),'report',p_report)),true);
 next_payload:=jsonb_set(next_payload,'{updatedAt}',to_jsonb(now()::text),true);
 update public.apex_assets set payload=next_payload where public.apex_assets.id=asset_tag;
 -- Populate the same refurbishment workflow used by Management Studio, not inventory identity/spec fields.
 -- This document update and receipt insert are part of the same PostgreSQL transaction.
 if p_source='refurbflow' then
  select document into workflow_doc from public.apex_refurb_workflow where singleton_id=1 for update;
  if not found then raise exception 'Cloud refurbishment workflow has not been installed';end if;
  jobs:=coalesce(workflow_doc->'jobs','{}'::jsonb);
  job:=jobs->asset_tag;
  if job is null then
   job:=jsonb_build_object('assetId',asset_tag,'status','Inspected','technician','',
     'priority','Normal','notes','','parts','[]'::jsonb,'qc','{}'::jsonb,
     'createdAt',now()::text,'updatedAt',now()::text);
  end if;
  parts:=coalesce(job->'parts','[]'::jsonb);
  if jsonb_typeof(p_report->'repairs')='array' then
   for inspection_part in select value from jsonb_array_elements(p_report->'repairs') loop
    part_name:=left(btrim(coalesce(inspection_part->>'name','')),160);
    if part_name='' then continue;end if;
    if coalesce(inspection_part->>'quantity','') !~ '^[0-9]{1,3}$' then
      raise exception 'Invalid RefurbFlow repair quantity'; end if;
    part_count:=(inspection_part->>'quantity')::integer;
    if part_count<1 or part_count>999 then raise exception 'Invalid RefurbFlow repair quantity';end if;
    part_key:='refurbflow:'||p_event_id||':'||part_name;
    if not exists(select 1 from jsonb_array_elements(parts) p(value) where p.value->>'sourceKey'=part_key) then
     requirement:=jsonb_build_object('id',md5(part_key||':'||asset_tag),
       'name',part_name,'qty',part_count,'received',0,'fitted',0,
       'sourceKey',part_key,'notes','','createdAt',now()::text);
     parts:=parts||jsonb_build_array(requirement);
    end if;
   end loop;
  end if;
  job:=jsonb_set(job,'{parts}',parts,true);
  job:=jsonb_set(job,'{updatedAt}',to_jsonb(now()::text),true);
  if jsonb_array_length(parts)>0 and job->>'status' in ('Received','Inspected','Ready for Repair') then
   job:=jsonb_set(job,'{status}',to_jsonb('Awaiting Parts'::text),true);
  end if;
  jobs:=jsonb_set(jobs,array[asset_tag],job,true);
  workflow_doc:=jsonb_set(workflow_doc,'{jobs}',jobs,true);
  update public.apex_refurb_workflow
   set document=workflow_doc,revision=revision+1,updated_at=now(),updated_by=auth.uid()
   where singleton_id=1;
 end if;
 insert into public.apex_device_intake_receipts(source,event_id,asset_id,actor)
 values(p_source,p_event_id,asset_tag,auth.uid());
 return jsonb_build_object('ok',true,'duplicate',false,'created',created,'reRegistered',reentry,'assetId',asset_tag);
end $$;
revoke all on function public.apex_receive_device_intake(text,text,text,jsonb) from public;
grant execute on function public.apex_receive_device_intake(text,text,text,jsonb) to authenticated;

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

-- Only the trusted hub's server-side service key can call this endpoint.
-- Paired testing laptops never receive that key or a general inventory write key.
create or replace function public.apex_receive_hub_diagnostics(
 p_event_id text,p_asset_id text,p_report jsonb,p_received_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare asset_tag text;deleted_time timestamptz;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Trusted hub service authorisation required' using errcode='42501';
 end if;
 asset_tag:=upper(btrim(coalesce(p_asset_id,'')));
 if p_received_at is null or p_received_at>clock_timestamp()+interval '2 minutes' then
  raise exception 'Invalid hub Diagnostics receipt time. Check the hub PC clock.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('apex-intake-asset:'||asset_tag,0));
 select deleted_at into deleted_time from public.apex_deleted_assets where id=asset_tag;
 if found and p_received_at<=deleted_time then
  raise exception 'This hub Diagnostics receipt predates deletion. Send a new Diagnostics report.' using errcode='22023';
 end if;
 return public.apex_receive_device_intake('diagnostics',p_event_id,asset_tag,p_report);
end $$;
revoke all on function public.apex_receive_hub_diagnostics(text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.apex_receive_hub_diagnostics(text,text,jsonb,timestamptz) to service_role;

commit;
