-- Repeatable asset audit deployment. Existing payloads and workflow documents are retained.
create table if not exists public.apex_asset_activity (
 asset_id text not null,
 event_key text not null,
 happened_at timestamptz not null,
 event jsonb not null,
 primary key(asset_id,event_key)
);
create index if not exists apex_asset_activity_timeline on public.apex_asset_activity(asset_id,happened_at desc,event_key desc);
alter table public.apex_asset_activity enable row level security;
revoke all on public.apex_asset_activity from public,anon,authenticated;

create or replace function public.apex_capture_asset_activity(p_asset_id text,p_event jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare event_time timestamptz; event_id text;
begin
 if jsonb_typeof(p_event) is distinct from 'object' or nullif(p_event->>'type','') is null then return;end if;
 begin event_time:=(p_event->>'at')::timestamptz;exception when others then return;end;
 if event_time is null or not exists(select 1 from public.apex_assets where id=p_asset_id) then return;end if;
 event_id:=coalesce(nullif(p_event->>'id',''),md5(jsonb_build_array(p_event->>'at',p_event->>'type',p_event->>'detail')::text));
 insert into public.apex_asset_activity(asset_id,event_key,happened_at,event) values(p_asset_id,event_id,event_time,p_event) on conflict do nothing;
end $$;
revoke all on function public.apex_capture_asset_activity(text,jsonb) from public,anon,authenticated;

create or replace function public.apex_archive_asset_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare e jsonb; has_new boolean:=false; fields text; actor text; previous jsonb;
begin
 if TG_OP='DELETE' then delete from public.apex_asset_activity where asset_id=OLD.id;return OLD;end if;
 actor:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email',nullif(current_setting('request.jwt.claim.sub',true),''),'Staff');
 previous:=case when TG_OP='UPDATE' then coalesce(OLD.payload,'{}'::jsonb) else '{}'::jsonb end;
 for e in select value from jsonb_array_elements(case when jsonb_typeof(NEW.payload->'history')='array' then NEW.payload->'history' else '[]'::jsonb end) loop
  if not (case when jsonb_typeof(previous->'history')='array' then previous->'history' else '[]'::jsonb end @> jsonb_build_array(e)) then has_new:=true;end if;
  perform public.apex_capture_asset_activity(NEW.id,e);
 end loop;
 -- Older clients and direct Diagnostics/RefurbFlow submissions may not supply a history entry.
 -- Capture the changed fields rather than silently losing these writes.
 if not has_new and (NEW.payload-array['history','updatedAt']) is distinct from (previous-array['history','updatedAt']) then
  select string_agg(k,', ' order by k) into fields from jsonb_object_keys(NEW.payload||previous) changes(k)
   where k not in ('history','updatedAt') and NEW.payload->k is distinct from previous->k;
  e:=jsonb_build_object('type',case when TG_OP='INSERT' then 'Intake' when NEW.payload->'diagnosticTests' is distinct from previous->'diagnosticTests' then 'Diagnostic results' when NEW.payload->'refurbflowIntake' is distinct from previous->'refurbflowIntake' then 'RefurbFlow' else 'Asset updated' end,
   'detail',case when TG_OP='INSERT' then 'Asset registered' else 'Updated: '||coalesce(fields,'asset information') end,'at',clock_timestamp(),'by',actor);
  perform public.apex_capture_asset_activity(NEW.id,e);
 end if;
 return NEW;
end $$;
revoke all on function public.apex_archive_asset_activity() from public,anon,authenticated;
drop trigger if exists apex_archive_asset_activity on public.apex_assets;
create trigger apex_archive_asset_activity after insert or update of payload or delete on public.apex_assets for each row execute function public.apex_archive_asset_activity();

create or replace function public.apex_archive_workflow_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare e jsonb; asset text; ord jsonb; line jsonb; job_entry record; job jsonb; previous_job jsonb; previous_doc jsonb; changes text; part_details text;
begin
 previous_doc:=case when TG_OP='UPDATE' then OLD.document else '{}'::jsonb end;
 for e in select value from jsonb_array_elements(case when jsonb_typeof(NEW.document->'audit')='array' then NEW.document->'audit' else '[]'::jsonb end) loop
  asset:=nullif(e->>'assetId','');
  if asset is not null then perform public.apex_capture_asset_activity(asset,e);
  else
   for ord in select value from jsonb_array_elements(coalesce(NEW.document->'orders','[]'::jsonb)||case when TG_OP='UPDATE' then coalesce(OLD.document->'orders','[]'::jsonb) else '[]'::jsonb end) loop
    if nullif(ord->>'id','') is not null and strpos(coalesce(e->>'detail',''),ord->>'id')>0 then
     for line in select value from jsonb_array_elements(coalesce(ord->'lines','[]'::jsonb)) loop
      perform public.apex_capture_asset_activity(line->>'assetId',e||jsonb_build_object('assetId',line->>'assetId'));
     end loop;
    end if;
   end loop;
  end if;
 end loop;
 -- Direct RefurbFlow imports can change jobs without creating a recent audit entry.
 for job_entry in select key from jsonb_each(coalesce(NEW.document->'jobs','{}'::jsonb)||coalesce(previous_doc->'jobs','{}'::jsonb)) loop
  job:=NEW.document->'jobs'->job_entry.key;previous_job:=previous_doc->'jobs'->job_entry.key;
  if (job-'updatedAt') is not distinct from (previous_job-'updatedAt') then continue;end if;
  if exists(select 1 from jsonb_array_elements(coalesce(NEW.document->'audit','[]'::jsonb)) a(value) where value->>'assetId'=job_entry.key and not (coalesce(previous_doc->'audit','[]'::jsonb) @> jsonb_build_array(value))) then continue;end if;
  select string_agg(k,', ' order by k) into changes from jsonb_object_keys(coalesce(job,'{}'::jsonb)||coalesce(previous_job,'{}'::jsonb)) fields(k) where k<>'updatedAt' and job->k is distinct from previous_job->k;
  select string_agg(coalesce(value->>'name','Part')||' × '||coalesce(value->>'qty','0')||' (received '||coalesce(value->>'received','0')||', fitted '||coalesce(value->>'fitted','0')||')','; ') into part_details from jsonb_array_elements(coalesce(job->'parts','[]'::jsonb)) p(value) where not (coalesce(previous_job->'parts','[]'::jsonb) @> jsonb_build_array(value));
  perform public.apex_capture_asset_activity(job_entry.key,jsonb_build_object('id',gen_random_uuid(),'type','Refurbishment updated','detail',left(case when job is null then 'Repair job removed' else 'Changed: '||coalesce(changes,'repair job')||case when part_details is null then '' else ' · '||part_details end end,2000),'at',clock_timestamp(),'by',coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email',nullif(current_setting('request.jwt.claim.sub',true),''),'Staff')));
 end loop;
 return NEW;
end $$;
revoke all on function public.apex_archive_workflow_activity() from public,anon,authenticated;
drop trigger if exists apex_archive_workflow_activity on public.apex_refurb_workflow;
create trigger apex_archive_workflow_activity after insert or update of document on public.apex_refurb_workflow for each row execute function public.apex_archive_workflow_activity();

create or replace function public.apex_get_asset_activity(p_asset_id text,p_before_at timestamptz default null,p_before_key text default null,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb; last_at timestamptz; last_key text; row_count integer; limit_count integer:=greatest(1,least(coalesce(p_limit,100),200));
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member';end if;
 if not exists(select 1 from public.apex_assets where id=p_asset_id) then raise exception 'Asset not found';end if;
 with page as materialized (
  select event,happened_at,event_key from public.apex_asset_activity where asset_id=p_asset_id
   and (p_before_at is null or (happened_at,event_key)<(p_before_at,p_before_key))
  order by happened_at desc,event_key desc limit limit_count+1
 ), selected as (select * from page order by happened_at desc,event_key desc limit limit_count)
 select coalesce((select jsonb_agg(event order by happened_at desc,event_key desc) from selected),'[]'::jsonb),
  (select happened_at from selected order by happened_at,event_key limit 1),
  (select event_key from selected order by happened_at,event_key limit 1),(select count(*) from page)
 into result,last_at,last_key,row_count;
 return jsonb_build_object('events',result,'nextCursor',case when row_count>limit_count then jsonb_build_object('at',last_at,'key',last_key) else null end);
end $$;
revoke all on function public.apex_get_asset_activity(text,timestamptz,text,integer) from public,anon;
grant execute on function public.apex_get_asset_activity(text,timestamptz,text,integer) to authenticated;

-- Recover all still-available historical entries without changing current inventory/workflow rows.
do $$
declare a record; e jsonb; w record; ord jsonb; line jsonb;
begin
 for a in select id,payload from public.apex_assets loop
  for e in select value from jsonb_array_elements(case when jsonb_typeof(a.payload->'history')='array' then a.payload->'history' else '[]'::jsonb end) loop perform public.apex_capture_asset_activity(a.id,e);end loop;
 end loop;
 for w in select document from public.apex_refurb_workflow loop
  for e in select value from jsonb_array_elements(coalesce(w.document->'audit','[]'::jsonb)) loop
   if nullif(e->>'assetId','') is not null then perform public.apex_capture_asset_activity(e->>'assetId',e);
   else
    for ord in select value from jsonb_array_elements(coalesce(w.document->'orders','[]'::jsonb)) loop
     if nullif(ord->>'id','') is not null and strpos(coalesce(e->>'detail',''),ord->>'id')>0 then
      for line in select value from jsonb_array_elements(coalesce(ord->'lines','[]'::jsonb)) loop perform public.apex_capture_asset_activity(line->>'assetId',e||jsonb_build_object('assetId',line->>'assetId'));end loop;
     end if;
    end loop;
   end if;
  end loop;
 end loop;
end $$;
