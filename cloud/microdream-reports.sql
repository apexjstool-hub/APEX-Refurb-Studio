-- Saved Microdream snapshots are independent of the refurbishment workflow document.
create table if not exists public.apex_microdream_reports(
 id uuid primary key,
 request_key text not null unique,
 report jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.apex_microdream_reports enable row level security;
revoke all on public.apex_microdream_reports from public,anon,authenticated;
create or replace function public.apex_microdream_report_action(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare action text:=p_input->>'action'; r jsonb; saved jsonb; result jsonb:='[]'::jsonb; ref text; expected bigint;
begin
 if auth.uid() is null or not public.apex_is_staff() then raise exception 'Not authorised';end if;
 if action='create' then
  if jsonb_typeof(p_input->'reports') is distinct from 'array' or jsonb_array_length(p_input->'reports') not between 1 and 300 or pg_column_size(p_input)>5242880 then raise exception 'Invalid report selection';end if;
  for r in select value from jsonb_array_elements(p_input->'reports') loop
   if jsonb_typeof(r->'document'->'rows') is distinct from 'array' or jsonb_array_length(r->'document'->'rows')=0 or jsonb_typeof(r->'assetIds') is distinct from 'array' or length(coalesce(r->>'palletName','')) not between 1 and 80 or length(coalesce(r->>'requestKey','')) not between 38 and 200 or r->>'revision' is distinct from '1' or length(coalesce(r->'document'->>'jobRef',''))>100 then raise exception 'Invalid saved report';end if;
   insert into public.apex_microdream_reports(id,request_key,report) values((r->>'id')::uuid,r->>'requestKey',r) on conflict(request_key) do nothing;
   select report into saved from public.apex_microdream_reports where request_key=r->>'requestKey';
   result:=result||jsonb_build_array(saved);
  end loop;
  return jsonb_build_object('ok',true,'reports',result);
 elsif action='list' then
  select coalesce(jsonb_agg(report order by created_at desc,id desc),'[]'::jsonb) into result from public.apex_microdream_reports where
   case when coalesce(report->>'palletCreatedAt','')<>'' and coalesce(p_input->'pallet'->>'createdAt','')<>'' then report->>'palletCreatedAt'=p_input->'pallet'->>'createdAt' else lower(report->>'palletName')=lower(trim(p_input->'pallet'->>'name')) end;
  return jsonb_build_object('ok',true,'reports',result);
 elsif action in ('get','update') then
  select report into saved from public.apex_microdream_reports where id=(p_input->>'id')::uuid for update;
  if not found then raise exception 'Saved report not found';end if;
  if action='update' then
   ref:=trim(coalesce(p_input->>'jobRef',''));expected:=(p_input->>'expectedRevision')::bigint;
   if length(ref)>100 or ref ~ '[[:cntrl:]]' then raise exception 'Job Ref must be one line of 100 characters or fewer';end if;
   if expected is distinct from (saved->>'revision')::bigint then raise exception 'This report was updated elsewhere. Reopen View report before saving';end if;
   saved:=jsonb_set(saved,'{document,jobRef}',to_jsonb(ref))||jsonb_build_object('revision',expected+1,'updatedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
   update public.apex_microdream_reports set report=saved where id=(p_input->>'id')::uuid;
  end if;
  return jsonb_build_object('ok',true,'report',saved);
 end if;
 raise exception 'Invalid report action';
end $$;
revoke all on function public.apex_microdream_report_action(jsonb) from public,anon;
grant execute on function public.apex_microdream_report_action(jsonb) to authenticated;
