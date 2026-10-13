-- Apply in Supabase SQL Editor after taking a database backup.
-- Full payload RPCs are limited to active authorised staff.
-- Existing records and privileges are not deleted.
create or replace function public.apex_create_full_asset(p_payload jsonb)
returns public.apex_assets
language plpgsql security definer set search_path = ''
as $$
declare rec public.apex_assets; asset_id text;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member'; end if;
 if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid asset payload'; end if;
 asset_id := p_payload->>'id';
 if asset_id is null or length(asset_id) < 1 or length(asset_id)>80
    or (p_payload->>'model') is null or length(p_payload->>'model')=0
 then raise exception 'Asset ID and model required'; end if;
 if pg_column_size(p_payload)>262144 then raise exception 'Asset payload too large'; end if;
 insert into public.apex_assets(id,payload) values (asset_id,p_payload) returning * into rec;
 return rec;
end $$;
revoke all on function public.apex_create_full_asset(jsonb) from public;
grant execute on function public.apex_create_full_asset(jsonb) to authenticated;

create or replace function public.apex_replace_full_asset(p_id text,p_expected_revision bigint,p_payload jsonb)
returns public.apex_assets
language plpgsql security definer set search_path = ''
as $$
declare rec public.apex_assets;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'id' is distinct from p_id
 then raise exception 'Asset identity mismatch'; end if;
 if p_payload->>'model' is null or length(p_payload->>'model')=0 or pg_column_size(p_payload)>262144
 then raise exception 'Invalid asset payload'; end if;
 update public.apex_assets set payload=p_payload
 where id=p_id and revision=p_expected_revision returning * into rec;
 if not found then raise exception 'Conflict or asset missing; refresh inventory'; end if;
 return rec;
end $$;
revoke all on function public.apex_replace_full_asset(text,bigint,jsonb) from public;
grant execute on function public.apex_replace_full_asset(text,bigint,jsonb) to authenticated;
