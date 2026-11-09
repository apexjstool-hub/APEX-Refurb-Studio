-- Apply after backing up Supabase. Atomic administrator-only record deletion.
-- No tables are dropped. Existing asset IDs and hardware records remain intact.
begin;
create or replace function public.apex_admin_delete_record(
 p_action text,p_asset_id text default null,p_expected_revision bigint default null,
 p_part_id text default null,p_order_id text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_id text:=upper(btrim(coalesce(p_asset_id,'')));
 v_asset public.apex_assets;
 v_workflow public.apex_refurb_workflow;
 v_doc jsonb;
 v_jobs jsonb;
 v_orders jsonb;
 v_job jsonb;
 v_part jsonb;
 v_payload jsonb;
 v_audit jsonb;
 v_removed integer:=0;
 v_detail text;
 v_event text;
begin
 if auth.uid() is null or not exists(
  select 1 from public.apex_staff where user_id=auth.uid() and active and role='admin'
 ) then raise exception 'Only an active APEX administrator can delete records' using errcode='42501'; end if;
 if p_action not in ('deletePart','deleteRefurb','deleteJob','clearTests','deleteOrder')
 then raise exception 'Unknown deletion action'; end if;
 if p_action<>'deleteOrder' then
  if v_id='' or p_expected_revision is null then raise exception 'Asset ID and revision required'; end if;
  select * into v_asset from public.apex_assets where id=v_id for update;
  if not found then raise exception 'Asset not found. Refresh inventory.'; end if;
  if v_asset.revision<>p_expected_revision then raise exception 'Asset changed. Refresh inventory.'; end if;
  if (v_asset.payload->>'deletedAt') is not null then raise exception 'Restore archived asset before clearing records.'; end if;
 end if;
 select * into v_workflow from public.apex_refurb_workflow where singleton_id=1 for update;
 if not found then raise exception 'Shared refurbishment not available. Nothing deleted.'; end if;
 v_doc:=v_workflow.document;
 v_jobs:=coalesce(v_doc->'jobs','{}'::jsonb);
 v_orders:=coalesce(v_doc->'orders','[]'::jsonb);
 v_event:=p_action;
 if p_action='deletePart' then
  v_job:=v_jobs->v_id;
  if v_job is null then raise exception 'No job for this asset'; end if;
  select x.value into v_part from jsonb_array_elements(coalesce(v_job->'parts','[]'::jsonb)) x(value)
   where x.value->>'id'=p_part_id limit 1;
  if v_part is null then raise exception 'Part not found. Refresh and retry.'; end if;
  v_detail:='Deleted part '||coalesce(v_part->>'name','')||' and linked purchase order lines';
  select count(*) into v_removed
   from jsonb_array_elements(v_orders) o(value),jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) l(value)
   where l.value->>'assetId'=v_id and l.value->>'partId'=p_part_id;
  v_job:=jsonb_set(v_job,'{parts}',(
   select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
   from jsonb_array_elements(coalesce(v_job->'parts','[]'::jsonb)) with ordinality x(value,ordinality)
   where x.value->>'id' is distinct from p_part_id),true);
  v_job:=jsonb_set(v_job,'{updatedAt}',to_jsonb(now()::text),true);
  v_jobs:=jsonb_set(v_jobs,array[v_id],v_job,true);
  select coalesce(jsonb_agg(
   jsonb_set(o.value,'{lines}',(
    select coalesce(jsonb_agg(l.value order by l.ordinality),'[]'::jsonb)
    from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) with ordinality l(value,ordinality)
    where not (l.value->>'assetId'=v_id and l.value->>'partId'=p_part_id)),true)
   order by o.ordinality),'[]'::jsonb)
  into v_orders from jsonb_array_elements(v_orders) with ordinality o(value,ordinality)
  where exists(select 1 from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) l(value)
   where not (l.value->>'assetId'=v_id and l.value->>'partId'=p_part_id));
 elsif p_action in ('deleteJob','deleteRefurb') then
  if p_action='deleteJob' and not v_jobs?v_id then raise exception 'Job not found'; end if;
  v_jobs:=v_jobs-v_id;
  select coalesce(jsonb_agg(
   jsonb_set(o.value,'{lines}',(
    select coalesce(jsonb_agg(l.value order by l.ordinality),'[]'::jsonb)
    from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) with ordinality l(value,ordinality)
    where l.value->>'assetId' is distinct from v_id),true)
   order by o.ordinality),'[]'::jsonb)
  into v_orders from jsonb_array_elements(v_orders) with ordinality o(value,ordinality)
  where exists(select 1 from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) l(value)
   where l.value->>'assetId' is distinct from v_id);
  v_detail:=case when p_action='deleteJob' then 'Deleted refurbishment job and linked order lines'
    else 'Cleared refurbishment report, notes, job and linked order lines' end;
  if p_action='deleteRefurb' then
   v_payload:=jsonb_set(v_asset.payload-'refurbishment','{refurbNotes}','""'::jsonb,true);
   v_payload:=jsonb_set(v_payload,'{updatedAt}',to_jsonb(now()::text),true);
   update public.apex_assets set payload=v_payload where id=v_id;
  end if;
 elsif p_action='clearTests' then
  v_detail:='Cleared imported diagnostics results';
  v_payload:=(v_asset.payload-'diagnosticTests')-'diagnosticsUpdatedAt';
  v_payload:=jsonb_set(v_payload,'{updatedAt}',to_jsonb(now()::text),true);
  update public.apex_assets set payload=v_payload where id=v_id;
 elsif p_action='deleteOrder' then
  if coalesce(p_order_id,'')='' or not exists(select 1 from jsonb_array_elements(v_orders) o(value) where o.value->>'id'=p_order_id)
  then raise exception 'Purchase order not found'; end if;
  -- Roll back recorded receipts on linked part requirements, without dropping below fitted counts.
  for v_part in select l.value from jsonb_array_elements(v_orders) o(value),
   jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) l(value)
   where o.value->>'id'=p_order_id
  loop
   v_job:=v_jobs->(v_part->>'assetId');
   if v_job is not null then
    v_job:=jsonb_set(v_job,'{parts}',(
     select coalesce(jsonb_agg(
       case when x.value->>'id'=v_part->>'partId' then
        jsonb_set(x.value,'{received}',to_jsonb(greatest(
         coalesce((x.value->>'fitted')::integer,0),
         coalesce((x.value->>'received')::integer,0)-coalesce((v_part->>'received')::integer,0))))
       else x.value end order by x.ordinality),'[]'::jsonb)
     from jsonb_array_elements(coalesce(v_job->'parts','[]'::jsonb)) with ordinality x(value,ordinality)),true);
    v_jobs:=jsonb_set(v_jobs,array[v_part->>'assetId'],v_job,true);
   end if;
  end loop;
  select coalesce(jsonb_agg(o.value order by o.ordinality),'[]'::jsonb)
   into v_orders from jsonb_array_elements(v_orders) with ordinality o(value,ordinality)
   where o.value->>'id' is distinct from p_order_id;
  v_detail:='Deleted purchase order '||p_order_id;
 end if;
 v_audit:=jsonb_build_array(jsonb_build_object(
  'id',gen_random_uuid()::text,'type',v_event,'at',now()::text,
  'assetId',v_id,'detail',v_detail,'by','Administrator'))||coalesce(v_doc->'audit','[]'::jsonb);
 select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_audit
  from jsonb_array_elements(v_audit) with ordinality x(value,ordinality) where x.ordinality<=2500;
 v_doc:=jsonb_set(v_doc,'{jobs}',v_jobs,true);
 v_doc:=jsonb_set(v_doc,'{orders}',v_orders,true);
 v_doc:=jsonb_set(v_doc,'{audit}',v_audit,true);
 update public.apex_refurb_workflow set document=v_doc,revision=revision+1,
  updated_at=now(),updated_by=auth.uid() where singleton_id=1;
 return jsonb_build_object('ok',true,'kind',p_action,'assetId',v_id,'linkedOrderLinesRemoved',v_removed);
end $$;
revoke all on function public.apex_admin_delete_record(text,text,bigint,text,text) from public,anon;
grant execute on function public.apex_admin_delete_record(text,text,bigint,text,text) to authenticated;
commit;
