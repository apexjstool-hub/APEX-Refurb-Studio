-- Step 1: cloud recycle-bin operations.
-- Review against the live project before running. No database changes happen from GitHub alone.
-- Existing revision trigger and apex_is_staff() are required.
create or replace function public.apex_set_asset_archived(
 p_id text, p_expected_revision bigint, p_archived boolean
) returns public.apex_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.apex_assets;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member'; end if;
 if p_id is null or p_expected_revision is null or p_archived is null
 then raise exception 'Invalid archive request'; end if;
 update public.apex_assets
 set payload = case when p_archived
    then jsonb_set(jsonb_set(payload, '{deletedAt}', to_jsonb(now()::text), true),
      '{deletedReason}', to_jsonb('Removed from Inventory'::text), true)
    else (payload - 'deletedReason') || jsonb_build_object('deletedAt', null)
  end
 where id = p_id and revision = p_expected_revision
   and (payload->>'deletedAt' is not null) is distinct from p_archived
 returning * into result;
 if not found then raise exception 'Record changed or already in requested state; refresh inventory'; end if;
 return result;
end $$;
revoke all on function public.apex_set_asset_archived(text,bigint,boolean) from public;
grant execute on function public.apex_set_asset_archived(text,bigint,boolean) to authenticated;
