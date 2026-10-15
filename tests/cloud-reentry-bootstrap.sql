-- Isolated CI database only. Never run this bootstrap against a live project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create function auth.role() returns text language sql stable as $
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated');
$;
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

-- Recreate the currently deployed, pre-patch marker schema, including existing data.
insert into public.apex_assets(id,payload) values('UPGRADE-KEEP','{"id":"UPGRADE-KEEP","model":"Keep this existing inventory"}');
drop table public.apex_diagnostic_reentry_permits;
alter table public.apex_deleted_assets drop column deleted_revision,drop column re_registered_at,drop column reentry_event_id;
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


insert into public.apex_deleted_assets(id) values('UPGRADE-MARKER');
