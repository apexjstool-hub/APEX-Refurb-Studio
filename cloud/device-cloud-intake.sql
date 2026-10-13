-- APEX device cloud intake: CREATE if new, UPDATE diagnostics if existing.
-- Requires existing public.apex_assets, public.apex_is_staff(), revision/audit triggers.
-- Idempotent install: preserves existing assets and intake receipts.
create table if not exists public.apex_device_intake_receipts (
 source text not null check(source in ('diagnostics','refurbflow')),
 event_id text not null,
 asset_id text not null,
 actor uuid not null,
 created_at timestamptz not null default now(),
 primary key (source,event_id)
);
alter table public.apex_device_intake_receipts enable row level security;
revoke all on public.apex_device_intake_receipts from anon, authenticated;

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
begin
 if not public.apex_is_staff() then raise exception 'Staff authorisation required' using errcode='42501';end if;
 asset_tag:=upper(btrim(coalesce(p_asset_id,'')));
 if p_source not in ('diagnostics','refurbflow') or p_event_id is null
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
  insert into public.apex_assets(id,payload) values(asset_tag,next_payload) returning * into rec;
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
 return jsonb_build_object('ok',true,'duplicate',false,'created',created,'assetId',asset_tag);
end $$;
revoke all on function public.apex_receive_device_intake(text,text,text,jsonb) from public;
grant execute on function public.apex_receive_device_intake(text,text,text,jsonb) to authenticated;
