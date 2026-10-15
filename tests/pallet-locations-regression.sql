-- Isolated transactional regression: no production data or credentials.
insert into public.apex_assets(id,payload) values('A','{"id":"A","pallet":"PALLET-0001","location":"Unassigned"}');
do $$
declare r jsonb;rev bigint;before_items jsonb;before_pallets jsonb;
begin
 select jsonb_agg(payload) into before_items from public.apex_assets;
 perform public.apex_inventory_location_pallet_action('addLocation','{"name":"Repair room"}',0);
 perform public.apex_inventory_location_pallet_action('createPallet','{"name":"PALLET-0001","label":"Batch"}',1);
 perform public.apex_inventory_location_pallet_action('createPallet','{"name":"PALLET-0002"}',2);
 perform public.apex_inventory_location_pallet_action('createPalletLocation','{"name":"Rack A"}',3);
 perform public.apex_inventory_location_pallet_action('createPalletLocation','{"name":"Rack B"}',4);
 r:=public.apex_inventory_location_pallet_action('movePallets','{"names":["PALLET-0001","PALLET-0002"],"location":"Rack A","expected":[{"name":"PALLET-0001","location":""},{"name":"PALLET-0002","location":""}]}',5);
 if (select count(*) from jsonb_array_elements(r->'pallets') p where p->>'storageLocation'='Rack A')<>2 then raise exception 'Bulk move count failed';end if;
 r:=public.apex_inventory_location_pallet_action('movePallets','{"names":["PALLET-0001"],"location":"Rack B","expected":[{"name":"PALLET-0001","location":"Rack A"}]}',6);
 if jsonb_array_length(r->'pallets')<>2 or (select count(*) from jsonb_array_elements(r->'pallets') p where p->>'storageLocation'='Rack A')<>1 then raise exception 'Pallet list or count changed incorrectly';end if;
 if (select jsonb_agg(payload) from public.apex_assets) is distinct from before_items then raise exception 'Pallet movement altered devices';end if;
 if (r->'locations') is distinct from '["Repair room"]'::jsonb then raise exception 'Device locations changed';end if;
 select pallets into before_pallets from public.apex_inventory_meta;
 begin
  perform public.apex_inventory_location_pallet_action('movePallets','{"names":["PALLET-0001","MISSING"],"location":"Rack A","expected":[{"name":"PALLET-0001","location":"Rack B"},{"name":"MISSING","location":""}]}',7);
  raise exception 'EXPECTED_INVALID_SELECTION';
 exception when others then if sqlerrm='EXPECTED_INVALID_SELECTION' then raise;end if;end;
 if (select pallets from public.apex_inventory_meta) is distinct from before_pallets then raise exception 'Partial pallet move was persisted';end if;
 begin
  perform public.apex_inventory_location_pallet_action('movePallets','{"names":["PALLET-0001"],"location":"Rack A","expected":[{"name":"PALLET-0001","location":""}]}',7);
  raise exception 'EXPECTED_STALE_SELECTION';
 exception when others then if sqlerrm='EXPECTED_STALE_SELECTION' then raise;end if;end;
 begin
  perform public.apex_inventory_location_pallet_action('createPalletLocation','{"name":"rack a"}',7);
  raise exception 'EXPECTED_DUPLICATE';
 exception when others then if sqlerrm='EXPECTED_DUPLICATE' then raise;end if;end;
 perform set_config('apex.test_staff','no',true);
 begin
  perform public.apex_inventory_location_pallet_action('createPalletLocation','{"name":"Forbidden"}',7);
  raise exception 'EXPECTED_PERMISSION_DENIAL';
 exception when others then if sqlerrm='EXPECTED_PERMISSION_DENIAL' then raise;end if;end;
 perform set_config('apex.test_staff','yes',true);
 if jsonb_array_length(public.apex_inventory_meta_get()->'palletLocations')<>2 then raise exception 'Location metadata was lost';end if;
end $$;
