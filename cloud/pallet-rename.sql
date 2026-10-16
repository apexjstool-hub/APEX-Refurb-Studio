begin;
-- Privileged implementation stays outside the exposed API schema.
create schema if not exists apex_inventory_private;
revoke all on schema apex_inventory_private from public,anon;
grant usage on schema apex_inventory_private to authenticated;
create or replace function apex_inventory_private.rename_pallet(p_name text,p_new_name text,p_meta_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare state public.apex_inventory_meta; asset public.apex_assets; old_name text;
 nm text:=regexp_replace(btrim(p_new_name),'\s+',' ','g');
 source text:=regexp_replace(btrim(p_name),'\s+',' ','g');
 pallet jsonb; updated_payload jsonb; at_time text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); cnt integer:=0;
begin
 if auth.uid() is null or not public.apex_is_staff() then raise exception 'Not an approved staff member';end if;
 if nm is null or length(nm)<1 or length(nm)>80 or nm ~ '[<>[:cntrl:]]' then raise exception 'Enter a pallet name of 1–80 characters without < or >';end if;
 select * into state from public.apex_inventory_meta where singleton_id=1 for update;
 if not found or state.revision is distinct from p_meta_revision then raise exception 'Pallets changed; refresh and try again';end if;
 -- Freeze assignments while checking uniqueness and renaming all active members.
 lock table public.apex_assets in share row exclusive mode;
 select value into pallet from jsonb_array_elements(state.pallets) p(value) where upper(value->>'name')=upper(source) limit 1;
 old_name:=pallet->>'name';
 if old_name is null then
  select a.payload->>'pallet' into old_name from public.apex_assets a where a.payload->>'deletedAt' is null and upper(a.payload->>'pallet')=upper(source) order by a.id limit 1;
  pallet:=jsonb_build_object('name',old_name,'label','','location','','storageLocation','','createdAt','');
 end if;
 if old_name is null then raise exception 'Pallet no longer exists; refresh and try again';end if;
 if exists(select 1 from jsonb_array_elements(state.pallets) p(value) where upper(value->>'name')=upper(nm) and upper(value->>'name')<>upper(old_name))
 or exists(select 1 from public.apex_assets a where a.payload->>'deletedAt' is null and upper(a.payload->>'pallet')=upper(nm) and upper(a.payload->>'pallet')<>upper(old_name)) then raise exception 'That pallet name already exists';end if;
 if old_name=nm then return jsonb_build_object('ok',true,'pallet',pallet,'renamed',0);end if;
 for asset in select * from public.apex_assets a where a.payload->>'deletedAt' is null and upper(a.payload->>'pallet')=upper(old_name) order by a.id for update loop
  updated_payload:=asset.payload||jsonb_build_object('pallet',nm,'updatedAt',at_time,'history',
   (case when jsonb_typeof(asset.payload->'history')='array' then asset.payload->'history' else '[]'::jsonb end)||jsonb_build_array(jsonb_build_object('id','rename-'||gen_random_uuid()::text,'type','Pallet assignment','detail',old_name||' → '||nm,'at',at_time)));
  update public.apex_assets set payload=updated_payload where id=asset.id;cnt:=cnt+1;
 end loop;
 pallet:=pallet||jsonb_build_object('name',nm,'updatedAt',at_time);
 state.pallets:=(select coalesce(jsonb_agg(case when upper(value->>'name')=upper(old_name) then pallet else value end order by ord),'[]'::jsonb) from jsonb_array_elements(state.pallets) with ordinality p(value,ord));
 if not exists(select 1 from jsonb_array_elements(state.pallets) p(value) where value->>'name'=nm) then state.pallets:=state.pallets||jsonb_build_array(pallet);end if;
 update public.apex_inventory_meta set pallets=state.pallets,revision=revision+1 where singleton_id=1;
 return jsonb_build_object('ok',true,'oldName',old_name,'pallet',pallet,'renamed',cnt,'revision',state.revision+1);
end $$;
revoke all on function apex_inventory_private.rename_pallet(text,text,bigint) from public,anon;
grant execute on function apex_inventory_private.rename_pallet(text,text,bigint) to authenticated;
create or replace function public.apex_rename_pallet(p_name text,p_new_name text,p_meta_revision bigint)
returns jsonb language sql security invoker set search_path=''
as $$select apex_inventory_private.rename_pallet(p_name,p_new_name,p_meta_revision)$$;
revoke all on function public.apex_rename_pallet(text,text,bigint) from public,anon;
grant execute on function public.apex_rename_pallet(text,text,bigint) to authenticated;
commit;
