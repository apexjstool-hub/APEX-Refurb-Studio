-- APEX CLOUD INVENTORY: READ-ONLY PRE-FLIGHT CHECKS
-- Safe to run in the EXISTING Supabase SQL Editor.
-- Does not create, update, or delete data/functions.
with expected_tables(name) as (
 values ('apex_assets'),('apex_staff'),('apex_audit'),
        ('apex_refurb_workflow'),('apex_inventory_meta')
),
expected_functions(name,args) as (
 values ('apex_is_staff',''),
 ('apex_create_full_asset','jsonb'),
 ('apex_replace_full_asset','text,bigint,jsonb'),
 ('apex_set_asset_archived','text,bigint,boolean'),
 ('apex_get_refurb_workflow',''),
 ('apex_save_refurb_workflow','bigint,jsonb'),
 ('apex_inventory_meta_get',''),
 ('apex_inventory_location_pallet_action','text,jsonb,bigint,jsonb')
)
select 'table' as kind,t.name as object,
  case when c.oid is null then 'NOT INSTALLED' else 'INSTALLED' end as state
from expected_tables t
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=t.name and c.relkind in ('r','p')
union all
select 'function', f.name||'('||f.args||')',
 case when to_regprocedure('public.'||f.name||'('||f.args||')') is null
 then 'NOT INSTALLED' else 'INSTALLED' end
from expected_functions f
order by kind,object;

-- Row-level security overview (all present project tables should report true).
select schemaname,tablename,rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('apex_assets','apex_staff','apex_audit',
                    'apex_refurb_workflow','apex_inventory_meta')
order by tablename;

-- NOTE: SQL Editor executes with elevated privileges. These queries do NOT
-- prove that a normal logged-in member can execute the RPC functions.
-- Execute migration SQL only after this preflight is reviewed.
