-- Repeatable pallet storage deployment, updated for asset move history in 4.0.58.
begin;
-- APEX cloud locations/pallets and atomic batch moves. Review before applying.
create table if not exists public.apex_inventory_meta (
 singleton_id integer primary key default 1 check (singleton_id=1),
 locations jsonb not null default '[]'::jsonb,
 pallets jsonb not null default '[]'::jsonb,
 revision bigint not null default 0
);
alter table public.apex_inventory_meta add column if not exists pallet_locations jsonb not null default '[]'::jsonb;
alter table public.apex_inventory_meta enable row level security;
revoke all on public.apex_inventory_meta from anon, authenticated;
insert into public.apex_inventory_meta(singleton_id) values(1)
on conflict(singleton_id) do nothing;

create or replace function public.apex_inventory_meta_get()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare state public.apex_inventory_meta;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member';end if;
 select * into state from public.apex_inventory_meta where singleton_id=1;
 return jsonb_build_object('locations',state.locations,'pallets',state.pallets,'palletLocations',state.pallet_locations,'revision',state.revision);
end $$;
revoke all on function public.apex_inventory_meta_get() from public, anon;
grant execute on function public.apex_inventory_meta_get() to authenticated;

-- Single SQL transaction for metadata updates and device transfers.
create or replace function public.apex_inventory_location_pallet_action(
 p_action text, p_input jsonb, p_meta_revision bigint, p_expected jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare state public.apex_inventory_meta;
        row_asset public.apex_assets;
        item jsonb; v_asset_id text; loc text; pal text; nm text;
        ids text[]; expected_revision bigint; cnt integer := 0;
        current_loc text; current_pal text; updated_payload jsonb;
        new_pallet jsonb; selected_name text; target text; current_storage text; snapshot jsonb;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member';end if;
 if p_action not in ('addLocation','deleteLocation','createPallet','deletePallet','bulkMove','undoBulkMove','createPalletLocation','movePallets','deletePalletLocation')
 then raise exception 'Unsupported cloud inventory operation'; end if;
 select * into state from public.apex_inventory_meta where singleton_id=1 for update;
 if not found then raise exception 'Cloud locations/pallets are not initialised';end if;
 if state.revision is distinct from p_meta_revision then raise exception 'Locations/pallets changed; refresh';end if;
 if p_action='createPalletLocation' then
  nm:=regexp_replace(btrim(p_input->>'name'),'\s+',' ','g');
  if nm is null or length(nm)<1 or length(nm)>90 or nm ~ '[<>[:cntrl:]]' then raise exception 'Invalid pallet location';end if;
  if exists(select 1 from jsonb_array_elements_text(state.pallet_locations) l(value) where lower(value)=lower(nm))
   or exists(select 1 from jsonb_array_elements(state.pallets) p(value) where lower(value->>'storageLocation')=lower(nm)) then raise exception 'Pallet location already exists';end if;
  state.pallet_locations:=state.pallet_locations||to_jsonb(nm);
 elsif p_action='deletePalletLocation' then
  select value into nm from jsonb_array_elements_text(state.pallet_locations) l(value) where lower(value)=lower(btrim(p_input->>'name'));
  if nm is null then raise exception 'Pallet location not found';end if;
  if exists(select 1 from jsonb_array_elements(state.pallets) p(value) where lower(value->>'storageLocation')=lower(nm)) then raise exception 'Move the pallets out before deleting this location';end if;
  state.pallet_locations:=(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements_text(state.pallet_locations) l(value) where lower(value)<>lower(nm));
 elsif p_action='movePallets' then
  if jsonb_typeof(p_input->'names') is distinct from 'array' or jsonb_array_length(p_input->'names') not between 1 and 300 then raise exception 'Select 1 to 300 pallets';end if;
  if jsonb_typeof(p_input->'expected') is distinct from 'array' or jsonb_array_length(p_input->'expected')<>jsonb_array_length(p_input->'names') then raise exception 'Refresh the pallets before moving';end if;
  target:=coalesce(btrim(p_input->>'location'),'');
  if target<>'' then
   select value into loc from jsonb_array_elements_text(state.pallet_locations) l(value) where lower(value)=lower(target);
   if loc is null then raise exception 'Pallet location not found';end if;
   target:=loc;
  end if;
  for selected_name in select upper(btrim(value)) from jsonb_array_elements_text(p_input->'names') n(value) loop
   if selected_name='' or selected_name=any(coalesce(ids,array[]::text[])) then raise exception 'Invalid or duplicate pallet';end if;
   ids:=array_append(ids,selected_name);
   select value into new_pallet from jsonb_array_elements(state.pallets) p(value) where upper(value->>'name')=selected_name;
   if new_pallet is null then
    select payload->>'pallet' into pal from public.apex_assets where upper(payload->>'pallet')=selected_name and payload->>'deletedAt' is null limit 1;
    if pal is null then raise exception 'Pallet not found; refresh';end if;
    new_pallet:=jsonb_build_object('name',pal,'label','','location','','createdAt','','storageLocation','');
    state.pallets:=state.pallets||jsonb_build_array(new_pallet);
   end if;
   select value into snapshot from jsonb_array_elements(p_input->'expected') e(value) where upper(btrim(value->>'name'))=selected_name;
   if snapshot is null or lower(coalesce(new_pallet->>'storageLocation','')) is distinct from lower(coalesce(snapshot->>'location','')) then raise exception 'Pallet location changed; refresh';end if;
   current_storage:=coalesce(new_pallet->>'storageLocation','');
   if lower(current_storage) is distinct from lower(target) then
    for row_asset in select * from public.apex_assets where upper(payload->>'pallet')=selected_name and payload->>'deletedAt' is null order by id for update loop
     updated_payload:=jsonb_set(row_asset.payload,'{history}',coalesce(row_asset.payload->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','Pallet location','detail','Pallet '||(new_pallet->>'name')||' moved: '||coalesce(nullif(current_storage,''),'Unassigned')||' → '||coalesce(nullif(target,''),'Unassigned'),'at',now(),'by',coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email',nullif(current_setting('request.jwt.claim.sub',true),''),'Staff'))),true);
     updated_payload:=jsonb_set(updated_payload,'{updatedAt}',to_jsonb(now()::text),true);
     update public.apex_assets set payload=updated_payload where id=row_asset.id;
    end loop;
   end if;
   new_pallet:=jsonb_set(jsonb_set(new_pallet,'{storageLocation}',to_jsonb(target),true),'{updatedAt}',to_jsonb(now()::text),true);
   state.pallets:=(select jsonb_agg(case when upper(value->>'name')=selected_name then new_pallet else value end) from jsonb_array_elements(state.pallets) p(value));
   cnt:=cnt+1;
  end loop;
 elsif p_action='addLocation' then
  nm:=btrim(p_input->>'name');
  if nm is null or length(nm)<1 or length(nm)>90 or nm ~ '[<>[:cntrl:]]' then raise exception 'Invalid location';end if;
  if exists(select 1 from jsonb_array_elements_text(state.locations) as l(value) where lower(l.value)=lower(nm)) then raise exception 'Location exists';end if;
  state.locations:=state.locations||to_jsonb(nm);
 elsif p_action='createPallet' then
  nm:=regexp_replace(btrim(p_input->>'name'),'\s+',' ','g');if nm is null or length(nm)<1 or length(nm)>80 or nm ~ '[<>[:cntrl:]]' then raise exception 'Enter a pallet name or number of 1–80 characters';end if;
  if exists(select 1 from jsonb_array_elements(state.pallets) as p(value) where upper(p.value->>'name')=upper(nm)) or exists(select 1 from public.apex_assets where upper(payload->>'pallet')=upper(nm) and payload->>'deletedAt' is null) then raise exception 'Pallet name or number already exists';end if;
  if length(coalesce(p_input->>'label',''))>90 or coalesce(p_input->>'label','') ~ '[<>[:cntrl:]]' then raise exception 'Invalid pallet label';end if;
  if jsonb_typeof(p_input->'ids')='array' and jsonb_array_length(p_input->'ids')>0 then raise exception 'Use a separate bulk move to assign laptops to a new pallet';end if;
  new_pallet:=jsonb_build_object('name',nm,'label',coalesce(p_input->>'label',''),'location','','createdAt',now()::text);
  state.pallets:=state.pallets||jsonb_build_array(new_pallet);
 elsif p_action='bulkMove' or p_action='undoBulkMove' then
  if jsonb_typeof(p_input->'moves') <> 'array' or jsonb_array_length(p_input->'moves') not between 1 and 300 then raise exception 'Invalid move list'; end if;
  for item in select value from jsonb_array_elements(p_input->'moves') loop
   v_asset_id:=item->>'id';
   if v_asset_id is null or length(v_asset_id)>80 then raise exception 'Invalid asset id';end if;
   if exists(select 1 from unnest(ids) as x(asset_id) where x.asset_id=v_asset_id) then raise exception 'Duplicate asset ID';end if;
   ids:=array_append(ids,v_asset_id);
   select * into row_asset from public.apex_assets where public.apex_assets.id=v_asset_id for update;
   if not found or row_asset.payload->>'deletedAt' is not null then raise exception 'Asset unavailable';end if;
   expected_revision:=(item->>'revision')::bigint;
   if row_asset.revision is distinct from expected_revision then raise exception 'Asset changed; refresh';end if;
   current_loc:=coalesce(row_asset.payload->>'location','Unassigned');
   current_pal:=coalesce(row_asset.payload->>'pallet','');
   if item ? 'expectedLocation' and current_loc is distinct from item->>'expectedLocation' then raise exception 'Location changed; refresh';end if;
   if item ? 'expectedPallet' and current_pal is distinct from item->>'expectedPallet' then raise exception 'Pallet changed; refresh';end if;
   loc:=coalesce(nullif(btrim(item->>'location'),''),'Unassigned');
   pal:=coalesce(btrim(item->>'pallet'),'');
   if pal<>'' then
     if not exists(select 1 from jsonb_array_elements(state.pallets) as p(value) where p.value->>'name'=pal)
       then raise exception 'Pallet not found';end if;
     loc:='Unassigned';
   elsif loc<>'Unassigned' and not exists(select 1 from jsonb_array_elements_text(state.locations) as l(value) where l.value=loc)
       then raise exception 'Location not found';end if;
   updated_payload:=jsonb_set(jsonb_set(row_asset.payload,'{location}',to_jsonb(loc),true),'{pallet}',to_jsonb(pal),true);
   if current_loc is distinct from loc or current_pal is distinct from pal then
    updated_payload:=jsonb_set(updated_payload,'{history}',coalesce(row_asset.payload->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','Transfer','detail','Location '||current_loc||' → '||loc||'; pallet '||coalesce(nullif(current_pal,''),'none')||' → '||coalesce(nullif(pal,''),'none'),'at',now(),'by',coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email',nullif(current_setting('request.jwt.claim.sub',true),''),'Staff'))),true);
   end if;
   updated_payload:=jsonb_set(updated_payload,'{updatedAt}',to_jsonb(now()::text),true);
   update public.apex_assets set payload=updated_payload where public.apex_assets.id=v_asset_id;
   cnt:=cnt+1;
  end loop;
 elsif p_action='deleteLocation' or p_action='deletePallet' then
  -- Destructive metadata edits deliberately require empty locations/pallets.
  nm:=p_input->>'name';
  if nm is null or nm='' then raise exception 'Name required'; end if;
  if p_action='deleteLocation' then
   if coalesce(nullif(p_input->>'moveTo',''),'')<>'' then raise exception 'Move assets separately before deleting the location';end if;
   if nm='Unassigned' or not exists(select 1 from jsonb_array_elements_text(state.locations) l(value) where l.value=nm) then raise exception 'Unknown location';end if;
   if exists(select 1 from public.apex_assets where payload->>'location'=nm and payload->>'deletedAt' is null) then raise exception 'Location contains assets: move them first';end if;
   state.locations:=(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements_text(state.locations) l(value) where value<>nm);
  else
   if exists(select 1 from public.apex_assets where payload->>'pallet'=nm and payload->>'deletedAt' is null) then raise exception 'Pallet contains assets: move them first';end if;
   if not exists(select 1 from jsonb_array_elements(state.pallets) p(value) where value->>'name'=nm) then raise exception 'Pallet not found';end if;
   state.pallets:=(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(state.pallets) p(value) where value->>'name'<>nm);
  end if;
 end if;
 update public.apex_inventory_meta set locations=state.locations,pallets=state.pallets,pallet_locations=state.pallet_locations,
    revision=revision+1 where singleton_id=1;
 return jsonb_build_object('ok',true,'locations',state.locations,'pallets',state.pallets,'palletLocations',state.pallet_locations,'moved',cnt,'revision',state.revision+1);
end $$;
revoke all on function public.apex_inventory_location_pallet_action(text,jsonb,bigint,jsonb) from public, anon;
grant execute on function public.apex_inventory_location_pallet_action(text,jsonb,bigint,jsonb) to authenticated;

commit;
