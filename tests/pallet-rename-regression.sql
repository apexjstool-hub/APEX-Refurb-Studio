begin;
update public.apex_inventory_meta set pallets='[{"name":"Old pallet","label":"Keep description","storageLocation":"Rack A","createdAt":"2025-01-01"},{"name":"Other"}]',revision=10 where singleton_id=1;
insert into public.apex_assets(id,payload) values ('RENAME-A','{"id":"RENAME-A","pallet":"Old pallet","location":"Unassigned","refurbNotes":"Keep notes","history":[]}'),('RENAME-B','{"id":"RENAME-B","pallet":"OLD PALLET","location":"Inspection","history":[]}'),('RENAME-C','{"id":"RENAME-C","pallet":"Other","history":[]}');
do $$declare r jsonb;begin
 r:=public.apex_rename_pallet('Old pallet','Custom / Batch 7',10);
 if (r->>'renamed')::int<>2 then raise exception 'Did not rename all members';end if;
 if (select count(*) from public.apex_assets where id in ('RENAME-A','RENAME-B') and payload->>'pallet'='Custom / Batch 7')<>2 then raise exception 'Device references not renamed';end if;
 if (select payload->>'refurbNotes' from public.apex_assets where id='RENAME-A')<>'Keep notes' or (select payload->>'location' from public.apex_assets where id='RENAME-B')<>'Inspection' then raise exception 'Unrelated device fields changed';end if;
 if (select pallets->0->>'storageLocation' from public.apex_inventory_meta where singleton_id=1)<>'Rack A' then raise exception 'Storage location lost';end if;
 if (select payload->'history'->0->>'type' from public.apex_assets where id='RENAME-A')<>'Pallet assignment' then raise exception 'History missing';end if;
 begin perform public.apex_rename_pallet('Custom / Batch 7','Other',11);raise exception 'Duplicate accepted';exception when others then if sqlerrm='Duplicate accepted' then raise;end if;end;
 begin perform public.apex_rename_pallet('Custom / Batch 7','Stale',10);raise exception 'Stale accepted';exception when others then if sqlerrm='Stale accepted' then raise;end if;end;
 if (select revision from public.apex_inventory_meta where singleton_id=1)<>11 then raise exception 'Failed rename partially changed metadata';end if;
 if has_function_privilege('anon','public.apex_rename_pallet(text,text,bigint)','execute') then raise exception 'Anonymous access';end if;
end $$;
select set_config('apex.test_staff','no',true);
do $$begin
 begin perform public.apex_rename_pallet('Custom / Batch 7','Denied',11);raise exception 'Nonstaff accepted';exception when others then if sqlerrm='Nonstaff accepted' then raise;end if;end;
end $$;
rollback;
