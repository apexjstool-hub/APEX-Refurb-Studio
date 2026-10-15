create role anon;
create role authenticated;
create table public.apex_assets(id text primary key,revision bigint default 0,payload jsonb not null);
create function public.apex_is_staff() returns boolean language sql as $$select coalesce(nullif(current_setting('apex.test_staff',true),''),'yes')='yes'$$;
