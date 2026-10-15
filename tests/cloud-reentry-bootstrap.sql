-- Isolated CI database only. Never run this bootstrap against a live project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on function auth.uid() to public;
\ir ../cloud/supabase.sql
\ir ../cloud/shared-inventory-migration.sql
\ir ../cloud/shared-refurb-workflow.sql
\ir ../cloud/device-cloud-intake.sql
\ir ../cloud/cloud-permanent-delete.sql
insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003');
insert into public.apex_staff(user_id,active,role) values
 ('10000000-0000-0000-0000-000000000001',true,'admin'),
 ('10000000-0000-0000-0000-000000000002',true,'staff'),
 ('10000000-0000-0000-0000-000000000003',false,'staff');
