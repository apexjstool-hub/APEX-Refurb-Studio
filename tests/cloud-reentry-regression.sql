-- Isolated regression database only.
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',message;end if;end $$;
create function public.test_error(statement text,expected_state text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if SQLSTATE=expected_state then return;end if;
  raise exception 'Unexpected SQLSTATE %, expected %: %',SQLSTATE,expected_state,SQLERRM;
 end;
 raise exception 'Expected SQLSTATE % but action succeeded: %',expected_state,statement;
end $$;
create function public.test_fail_receipt() returns trigger language plpgsql as $$
begin if new.event_id='diag-rollback-trigger' then raise exception 'Intentional transaction rollback';end if;return new;end $$;
create trigger test_fail_receipt after insert on public.apex_device_intake_receipts for each row execute function public.test_fail_receipt();

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.test_assert(not has_table_privilege('authenticated','public.apex_diagnostic_reentry_permits','INSERT'),'Clients cannot issue re-entry permits');
select public.test_assert(not has_table_privilege('authenticated','public.apex_diagnostic_reentry_permits','SELECT'),'Clients cannot inspect permits');
select public.test_assert((public.apex_receive_device_intake('diagnostics','diag-initial-74484','74484','{"assetId":"74484","model":"OLD MODEL","serial":"OLD-SERIAL"}')->>'created')::boolean,'Initial Diagnostics registration');
select public.apex_update_asset('74484',(select revision from public.apex_assets where id='74484'),'{"notes":"Old life notes","location":"OLD LOCATION","condition":"D"}');
select public.apex_receive_device_intake('refurbflow','refurb-old-74484','74484','{"assetId":"74484","repairs":[{"name":"Old keyboard","quantity":1}]}');
reset role;
create table public.test_saved_revisions(id text primary key,revision bigint);
insert into public.test_saved_revisions select id,revision from public.apex_assets where id='74484';
grant select on public.test_saved_revisions to authenticated;
set role authenticated;
select public.apex_hard_delete_asset('74484',(select revision from public.apex_assets where id='74484'));
select public.test_assert(not exists(select 1 from public.apex_assets where id='74484'),'Deleted device absent');
select public.test_assert((public.apex_receive_device_intake('diagnostics','diag-initial-74484','74484','{"assetId":"74484","model":"OLD MODEL"}')->>'duplicate')::boolean,'Accepted old diagnostic event remains a duplicate');
select public.test_assert(not exists(select 1 from public.apex_assets where id='74484'),'Old event does not restore device');
select public.test_error($q$select public.apex_receive_device_intake('refurbflow','refurb-new-blocked','74484','{"assetId":"74484","repairs":[]}')$q$,'P0002');
select public.test_error($q$select public.apex_create_full_asset('{"id":"74484","model":"STALE SYNC"}')$q$,'23505');
select public.test_assert((public.apex_receive_device_intake('diagnostics','diag-new-life-74484','74484','{"assetId":"74484","model":"NEW MODEL","serial":"NEW-SERIAL"}')->>'reRegistered')::boolean,'New diagnostics automatically re-registers deleted tag');
select public.test_assert((select payload->>'model'='NEW MODEL' and payload->>'serial'='NEW-SERIAL' and payload->>'condition'='Not assessed' and payload->>'location'='Unassigned' and coalesce(payload->>'notes','')='' from public.apex_assets where id='74484'),'Re-registration starts with fresh identity, grade and location');
select public.test_assert((select revision>(select revision from public.test_saved_revisions where id='74484') from public.apex_assets where id='74484'),'New incarnation revision exceeds previous incarnation');
select public.test_assert((public.apex_get_refurb_workflow()->'workflow'->'jobs'->'74484') is null,'Old refurbishment requirements remain deleted');
select public.test_assert((select jsonb_array_length(payload->'diagnosticsIntake')=1 from public.apex_assets where id='74484'),'New asset has only the new diagnostics report');
select public.test_error($q$select public.apex_replace_full_asset('74484',(select revision from public.test_saved_revisions where id='74484'),'{"id":"74484","model":"STALE UPDATE"}')$q$,'P0001');
select public.test_assert((public.apex_receive_device_intake('diagnostics','diag-new-life-74484','74484','{"assetId":"74484","model":"RETRY"}')->>'duplicate')::boolean,'New report retries are idempotent');
select public.apex_receive_device_intake('diagnostics','diag-update-new-life','74484','{"assetId":"74484","model":"NEW MODEL UPDATED"}');
select public.test_assert((select payload->>'model'='NEW MODEL UPDATED' from public.apex_assets where id='74484'),'Further diagnostic updates work');
select public.apex_hard_delete_asset('74484',(select revision from public.apex_assets where id='74484'));
select public.test_assert(not exists(select 1 from public.apex_assets where id='74484'),'Second deletion works');
select public.test_assert((public.apex_receive_device_intake('diagnostics','diag-new-life-74484','74484','{"assetId":"74484","model":"RETRY"}')->>'duplicate')::boolean,'Second-life old report does not resurrect after second deletion');
select public.apex_receive_device_intake('diagnostics','diag-third-life-74484','74484','{"assetId":"74484","model":"THIRD LIFE"}');
select public.test_assert((select payload->>'model'='THIRD LIFE' from public.apex_assets where id='74484'),'Tag can be deleted and re-tested repeatedly');
reset role;
select public.test_assert((select deleted_revision is not null and re_registered_at is not null and reentry_event_id='diag-third-life-74484' from public.apex_deleted_assets where id='74484'),'Deletion marker is retained with recorded re-entry');
select public.test_assert(not exists(select 1 from public.apex_diagnostic_reentry_permits),'Permits are consumed');
select public.test_assert((select count(*)=1 from public.apex_device_intake_receipts where source='diagnostics' and event_id='diag-new-life-74484'),'Receipt history retained without duplicate writes');

-- A marker created by the old deletion implementation also supports re-entry.
insert into public.apex_deleted_assets(id) values('LEGACY-TAG');
set role authenticated;
select public.apex_receive_device_intake('diagnostics','diag-legacy-tag-new','LEGACY-TAG','{"assetId":"LEGACY-TAG","model":"Legacy laptop"}');
select public.test_assert(exists(select 1 from public.apex_assets where id='LEGACY-TAG'),'Legacy marker without revision is supported');

-- Rollback must preserve the marker and leave no partial device or permit.
select public.apex_hard_delete_asset('LEGACY-TAG',(select revision from public.apex_assets where id='LEGACY-TAG'));
select public.test_error($q$select public.apex_receive_device_intake('diagnostics','diag-rollback-trigger','LEGACY-TAG','{"assetId":"LEGACY-TAG","model":"Must roll back"}')$q$,'P0001');
select public.test_assert(not exists(select 1 from public.apex_assets where id='LEGACY-TAG'),'Failed report leaves no half-created asset');
reset role;
select public.test_assert(not exists(select 1 from public.apex_diagnostic_reentry_permits),'Failed report leaves no permit');
select public.test_assert((select re_registered_at is null from public.apex_deleted_assets where id='LEGACY-TAG'),'Failed report does not record successful re-entry');

-- Invalid requests cannot obtain a re-entry permit.
set role authenticated;
select public.test_error($q$select public.apex_receive_device_intake(null,'diag-invalid-source','LEGACY-TAG','{"assetId":"LEGACY-TAG","model":"Invalid"}')$q$,'22023');
select public.test_error($q$select public.apex_receive_device_intake('diagnostics','diag-wrong-asset-tag','LEGACY-TAG','{"assetId":"OTHER","model":"Invalid"}')$q$,'22023');
reset role;
-- Auth rules remain in force.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
set role authenticated;
select public.test_error($q$select public.apex_receive_device_intake('diagnostics','diag-inactive-staff','DENIED','{"assetId":"DENIED","model":"Denied"}')$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
set role authenticated;
select public.apex_receive_device_intake('diagnostics','diag-active-staff-new','STAFF-TAG','{"assetId":"STAFF-TAG","model":"Staff registration"}');
select public.test_error($q$select public.apex_hard_delete_asset('STAFF-TAG',(select revision from public.apex_assets where id='STAFF-TAG'))$q$,'42501');
reset role;
-- Simulate a privileged old sync bridge: even bypass-RLS cannot bypass the trigger.
select public.test_error($q$insert into public.apex_assets(id,payload) values('LEGACY-TAG','{"id":"LEGACY-TAG","model":"STALE BRIDGE"}')$q$,'23505');
select public.test_assert(exists(select 1 from public.apex_deleted_assets where id='LEGACY-TAG'),'Stale sync protection remains installed');
select 'PASS: automatic Diagnostics re-entry, repeat deletions, replay protection, stale revisions, RLS and transactional rollback';
