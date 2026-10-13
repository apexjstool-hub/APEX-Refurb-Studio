-- APEX shared refurbishment document. Development migration: review and test before applying.
create table if not exists public.apex_refurb_workflow (
 singleton_id integer primary key default 1 check (singleton_id=1),
 document jsonb not null default '{"jobs":{},"orders":[],"audit":[]}'::jsonb,
 revision bigint not null default 0,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.apex_refurb_workflow enable row level security;
revoke all on public.apex_refurb_workflow from anon, authenticated;
insert into public.apex_refurb_workflow(singleton_id) values (1)
on conflict(singleton_id) do nothing;

create or replace function public.apex_get_refurb_workflow()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare state public.apex_refurb_workflow;
begin
 if not public.apex_is_staff() then raise exception 'Not authorised'; end if;
 select * into state from public.apex_refurb_workflow where singleton_id=1;
 if not found then raise exception 'Workflow not initialised'; end if;
 return jsonb_build_object('workflow',state.document,'revision',state.revision);
end $$;
revoke all on function public.apex_get_refurb_workflow() from public;
grant execute on function public.apex_get_refurb_workflow() to authenticated;

create or replace function public.apex_save_refurb_workflow(p_expected_revision bigint,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare state public.apex_refurb_workflow;
 j record;
 p jsonb;
 o jsonb;
 ln jsonb;
 job jsonb;
 qty integer;
 received integer;
 fitted integer;
begin
 if not public.apex_is_staff() then raise exception 'Not authorised'; end if;
 if p_expected_revision is null or p_document is null
  or jsonb_typeof(p_document)<>'object'
  or jsonb_typeof(p_document->'jobs')<>'object'
  or jsonb_typeof(p_document->'orders')<>'array'
  or jsonb_typeof(p_document->'audit')<>'array'
  or pg_column_size(p_document)>10485760
 then raise exception 'Invalid workflow document'; end if;
 if jsonb_array_length(p_document->'orders')>10000
  or jsonb_array_length(p_document->'audit')>2500
 then raise exception 'Workflow limit exceeded'; end if;
 for j in select key,value from jsonb_each(p_document->'jobs') loop
  if length(j.key) not between 1 and 80
   or jsonb_typeof(j.value)<>'object'
   or j.value->>'assetId' is distinct from j.key
   or jsonb_typeof(j.value->'parts')<>'array'
   or jsonb_typeof(j.value->'qc')<>'object'
  then raise exception 'Invalid refurbishment job'; end if;
  if not exists(select 1 from public.apex_assets a where a.id=j.key)
  then raise exception 'Unknown job asset'; end if;
  if jsonb_array_length(j.value->'parts')>1000 then raise exception 'Too many parts'; end if;
  for p in select value from jsonb_array_elements(j.value->'parts') loop
   if jsonb_typeof(p)<>'object'
    or nullif(p->>'id','') is null
    or nullif(p->>'name','') is null
    or coalesce(p->>'qty','') !~ '^[0-9]{1,4}$'
    or coalesce(p->>'received','') !~ '^[0-9]{1,4}$'
    or coalesce(p->>'fitted','') !~ '^[0-9]{1,4}$'
   then raise exception 'Invalid required part'; end if;
   qty:=(p->>'qty')::integer;
   received:=(p->>'received')::integer;
   fitted:=(p->>'fitted')::integer;
   if qty<1 or qty>9999 or received>qty or fitted>received
   then raise exception 'Invalid required part quantities'; end if;
  end loop;
 end loop;
 for o in select value from jsonb_array_elements(p_document->'orders') loop
  if jsonb_typeof(o)<>'object' or nullif(o->>'id','') is null
   or jsonb_typeof(o->'lines')<>'array'
  then raise exception 'Invalid purchase order'; end if;
  if jsonb_array_length(o->'lines')>1000 then raise exception 'Too many order lines'; end if;
  for ln in select value from jsonb_array_elements(o->'lines') loop
   if jsonb_typeof(ln)<>'object'
    or nullif(ln->>'assetId','') is null
    or nullif(ln->>'partId','') is null
    or coalesce(ln->>'qty','') !~ '^[0-9]{1,4}$'
    or coalesce(ln->>'received','') !~ '^[0-9]{1,4}$'
   then raise exception 'Invalid order line'; end if;
   qty:=(ln->>'qty')::integer;
   received:=(ln->>'received')::integer;
   if qty<1 or qty>9999 or received>qty
   then raise exception 'Invalid order quantities'; end if;
   job:=p_document->'jobs'->(ln->>'assetId');
   if job is null or jsonb_typeof(job)<>'object'
    or not exists(select 1 from jsonb_array_elements(job->'parts') x(value)
      where x.value->>'id'=ln->>'partId')
   then raise exception 'Purchase order references unknown job or part'; end if;
  end loop;
 end loop;
 update public.apex_refurb_workflow
 set document=p_document,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where singleton_id=1 and revision=p_expected_revision
 returning * into state;
 if not found then raise exception 'Workflow conflict; refresh before retrying'; end if;
 return jsonb_build_object('workflow',state.document,'revision',state.revision);
end $$;
revoke all on function public.apex_save_refurb_workflow(bigint,jsonb) from public;
grant execute on function public.apex_save_refurb_workflow(bigint,jsonb) to authenticated;
