-- Runs only against the isolated CI fixture database.
do $$
declare r jsonb; second_page jsonb; count_before integer;
begin
 if not exists(select 1 from public.apex_asset_activity where asset_id='A' and event->>'type'='Pallet location') then raise exception 'Cloud pallet moves were not archived';end if;
 if not exists(select 1 from public.apex_asset_activity where asset_id='A' and event->>'detail' like '%Rack A → Rack B%') then raise exception 'Move destinations missing';end if;
 insert into public.apex_assets(id,payload) select 'AUDIT-ONLY',jsonb_build_object('id','AUDIT-ONLY','model','Test laptop','history',jsonb_agg(jsonb_build_object('type','Specification','detail','Old event '||i,'at',timestamptz '2026-01-01'+i*interval '1 second'))) from generate_series(1,120) i;
 update public.apex_assets set payload=jsonb_build_object('id','AUDIT-ONLY','model','Test laptop','history',jsonb_build_array(jsonb_build_object('type','Pallet assignment','detail','No pallet → Test pallet','at','2026-02-01T00:00:00Z'))) where id='AUDIT-ONLY';
 if (select count(*) from public.apex_asset_activity where asset_id='AUDIT-ONLY')<>121 then raise exception 'Old inventory history was lost';end if;
 update public.apex_refurb_workflow set document='{"jobs":{},"orders":[],"audit":[{"id":"fitted-1","assetId":"AUDIT-ONLY","type":"Part fitted","detail":"Battery × 1","by":"Operator","at":"2026-03-01T00:00:00Z"}]}'::jsonb where singleton_id=1;
 update public.apex_refurb_workflow set document='{"jobs":{},"orders":[],"audit":[]}'::jsonb where singleton_id=1;
 if not exists(select 1 from public.apex_asset_activity where asset_id='AUDIT-ONLY' and event->>'id'='fitted-1') then raise exception 'Workflow rolling-window removal lost audit';end if;
 r:=public.apex_get_asset_activity('AUDIT-ONLY',null,null,100);
 if jsonb_array_length(r->'events')<>100 or r->'events'->0->>'type'<>'Part fitted' then raise exception 'Chronological activity pagination failed';end if;
 second_page:=public.apex_get_asset_activity('AUDIT-ONLY',(r->'nextCursor'->>'at')::timestamptz,r->'nextCursor'->>'key',100);
 if jsonb_array_length(second_page->'events')<>22 or second_page->'nextCursor'<>'null'::jsonb then raise exception 'Older event pagination failed';end if;
 if exists(select 1 from jsonb_array_elements(r->'events') a join jsonb_array_elements(second_page->'events') b on a=b) then raise exception 'Duplicate page events';end if;
 select count(*) into count_before from public.apex_asset_activity where asset_id='AUDIT-ONLY';
 perform public.apex_capture_asset_activity('AUDIT-ONLY','{"id":"fitted-1","assetId":"AUDIT-ONLY","type":"Part fitted","detail":"Battery × 1","by":"Operator","at":"2026-03-01T00:00:00Z"}');
 if (select count(*) from public.apex_asset_activity where asset_id='AUDIT-ONLY')<>count_before then raise exception 'Repeated events were duplicated';end if;
 if has_table_privilege('anon','public.apex_asset_activity','SELECT') or has_table_privilege('authenticated','public.apex_asset_activity','SELECT') then raise exception 'Direct audit access is exposed';end if;
 if has_function_privilege('anon','public.apex_get_asset_activity(text,timestamptz,text,integer)','EXECUTE') or has_function_privilege('authenticated','public.apex_capture_asset_activity(text,jsonb)','EXECUTE') then raise exception 'Audit function permissions are too broad';end if;
 update public.apex_refurb_workflow set document=jsonb_set(document,'{jobs}', '{"AUDIT-ONLY":{"assetId":"AUDIT-ONLY","parts":[{"id":"new","name":"Battery","qty":1,"received":0,"fitted":0}],"status":"Awaiting Parts","qc":{}}}'::jsonb) where singleton_id=1;
 if not exists(select 1 from public.apex_asset_activity where asset_id='AUDIT-ONLY' and event->>'type'='Refurbishment updated' and event->>'detail' like '%Battery%') then raise exception 'Direct RefurbFlow job changes missing';end if;
 perform set_config('apex.test_staff','no',true);
 begin perform public.apex_get_asset_activity('AUDIT-ONLY');raise exception 'EXPECTED_AUDIT_DENIAL';exception when others then if sqlerrm='EXPECTED_AUDIT_DENIAL' then raise;end if;end;
 perform set_config('apex.test_staff','yes',true);
 delete from public.apex_assets where id='AUDIT-ONLY';
 if not exists(select 1 from public.apex_asset_activity where asset_id='AUDIT-ONLY' and event->>'id'='fitted-1') or not exists(select 1 from public.apex_asset_activity where asset_id='AUDIT-ONLY' and event->>'type'='Asset permanently deleted') then raise exception 'Asset removal erased or failed to record its audit trail';end if;
end $$;
