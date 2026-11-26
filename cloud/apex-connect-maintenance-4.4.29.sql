-- APEX Connect Maintenance 1.1 / 4.4.29.
-- Retention is OFF by default; turning it on is an explicit admin choice.
-- Does not delete inventory, repair notes, audit trails or other tables.
create extension if not exists pg_cron with schema pg_catalog;
create table if not exists public.apex_connect_maintenance (
 id integer primary key default 1 check(id=1),
 enabled boolean not null default false,
 retention_days integer not null default 90 check(retention_days in (30,90,180,365)),
 last_run_at timestamptz,
 last_deleted integer not null default 0,
 deleted_total bigint not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.apex_connect_maintenance(id,enabled,retention_days)
values (1,false,90) on conflict (id) do nothing;
alter table public.apex_connect_maintenance enable row level security;
revoke all on public.apex_connect_maintenance from public, anon, authenticated;

create schema if not exists apex_connect_private;
revoke all on schema apex_connect_private from public, anon, authenticated;

-- The internal cleanup function is NOT exposed by Supabase's public Data API.
-- One run deletes at most 500 expired messages; the job runs once per day.
create or replace function apex_connect_private.cleanup_messages(p_limit integer default 500,p_force boolean default false)
returns integer language plpgsql security definer set search_path=pg_catalog
as $$
declare cfg record; removed integer:=0; max_rows integer;
begin
 select * into cfg from public.apex_connect_maintenance where id=1 for update;
 if not found or (not cfg.enabled and not p_force) then return 0; end if;
 max_rows := least(greatest(coalesce(p_limit,500),1),500);
 with expired as (
   select id from public.apex_connect_messages
   where created_at < now() - make_interval(days=>cfg.retention_days)
   order by id asc limit max_rows
   for update skip locked
 ), gone as (
   delete from public.apex_connect_messages m
   using expired x where m.id=x.id returning m.id
 )
 select count(*) into removed from gone;
 update public.apex_connect_maintenance
   set last_run_at=now(),last_deleted=removed,deleted_total=deleted_total+removed
   where id=1;
 return removed;
end;
$$;
revoke all on function apex_connect_private.cleanup_messages(integer,boolean) from public,anon,authenticated;

-- Public RPC entry points have *no* arbitrary SQL parameters or table permissions.
-- Verify active admin directly against public.apex_staff; deny anonymous callers.
create or replace function public.apex_connect_maintenance_status()
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare cfg record;
begin
 if auth.uid() is null or not exists (
   select 1 from public.apex_staff s where s.user_id=auth.uid() and s.active and s.role='admin'
 ) then raise exception 'APEX cloud administrator required' using errcode='42501'; end if;
 select * into cfg from public.apex_connect_maintenance where id=1;
 return jsonb_build_object(
   'enabled',cfg.enabled,'retentionDays',cfg.retention_days,
   'lastRunAt',cfg.last_run_at,'lastDeleted',cfg.last_deleted,'deletedTotal',cfg.deleted_total,
   'messageCount',(select count(*) from public.apex_connect_messages),
   'storageBytes',pg_total_relation_size('public.apex_connect_messages'::regclass),
   'scheduled','03:00 UTC daily',
   'updatedAt',cfg.updated_at
 );
end;
$$;
create or replace function public.apex_connect_maintenance_save(p_enabled boolean,p_days integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
begin
 if auth.uid() is null or not exists (
   select 1 from public.apex_staff s where s.user_id=auth.uid() and s.active and s.role='admin'
 ) then raise exception 'APEX cloud administrator required' using errcode='42501'; end if;
 if p_enabled is null or p_days not in (30,90,180,365) or p_days is null
 then raise exception 'Choose an allowed retention period (30, 90, 180, 365 days)' using errcode='22023'; end if;
 update public.apex_connect_maintenance
 set enabled=p_enabled,retention_days=p_days,updated_at=now() where id=1;
 return public.apex_connect_maintenance_status();
end;
$$;
create or replace function public.apex_connect_maintenance_run()
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare n integer;
begin
 if auth.uid() is null or not exists (
   select 1 from public.apex_staff s where s.user_id=auth.uid() and s.active and s.role='admin'
 ) then raise exception 'APEX cloud administrator required' using errcode='42501'; end if;
 n:=apex_connect_private.cleanup_messages(500,true);
 return jsonb_build_object('ok',true,'deleted',n,'limit',500);
end;
$$;
revoke all on function public.apex_connect_maintenance_status() from public,anon;
revoke all on function public.apex_connect_maintenance_save(boolean,integer) from public,anon;
revoke all on function public.apex_connect_maintenance_run() from public,anon;
grant execute on function public.apex_connect_maintenance_status() to authenticated;
grant execute on function public.apex_connect_maintenance_save(boolean,integer) to authenticated;
grant execute on function public.apex_connect_maintenance_run() to authenticated;

-- pg_cron is database-side and runs even if all APEX clients are closed.
-- Scheduled task is harmless until an admin explicitly enables retention.
select cron.schedule('apex-connect-daily-retention','0 3 * * *',
  'select apex_connect_private.cleanup_messages(500,false);');
