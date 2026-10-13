-- APEX cloud inventory; run in Supabase SQL Editor. Auth users added by administrator.
create table if not exists public.apex_assets (
 id text primary key,
 payload jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
create table if not exists public.apex_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 role text not null default 'staff' check (role in ('staff','admin'))
);
create table if not exists public.apex_audit (
 id bigint generated always as identity primary key,
 asset_id text not null,
 actor uuid,
 changed_at timestamptz not null default now(),
 change_kind text not null,
 revision bigint not null
);
create index if not exists apex_audit_asset_idx on public.apex_audit(asset_id, changed_at desc);
create or replace function public.apex_is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.apex_staff where user_id=auth.uid() and active=true);
$$;
-- Reject edits to historical revisions. Revision is server controlled.
create or replace function public.apex_before_asset() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.revision:=1;
 else
  if new.revision <> old.revision then
   raise exception 'Revision cannot be manually changed';
  end if;
  new.revision:=old.revision+1;
 end if;
 if new.payload->>'id' is distinct from new.id then raise exception 'Asset ID does not match'; end if;
 new.updated_at:=now();
 new.updated_by:=auth.uid();
 return new;
end $$;
drop trigger if exists apex_asset_change on public.apex_assets;
create trigger apex_asset_change before insert or update on public.apex_assets
for each row execute function public.apex_before_asset();
create or replace function public.apex_log_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.apex_audit(asset_id,actor,change_kind,revision) values(new.id,new.updated_by,TG_OP,new.revision);
 return new;
end $$;
drop trigger if exists apex_asset_audit on public.apex_assets;
create trigger apex_asset_audit after insert or update on public.apex_assets for each row execute function public.apex_log_change();
alter table public.apex_assets enable row level security;
alter table public.apex_staff enable row level security;
alter table public.apex_audit enable row level security;
revoke all on public.apex_assets,public.apex_staff,public.apex_audit from anon;
grant select on public.apex_assets to authenticated;
grant select on public.apex_staff,public.apex_audit to authenticated;
drop policy if exists "Staff can view assets" on public.apex_assets;
drop policy if exists "Staff can add assets" on public.apex_assets;
drop policy if exists "Staff can edit assets" on public.apex_assets;
drop policy if exists "Staff see own profile" on public.apex_staff;
drop policy if exists "Staff view audit" on public.apex_audit;
create policy "Staff can view assets" on public.apex_assets for select to authenticated using (public.apex_is_staff());
create policy "Staff see own profile" on public.apex_staff for select to authenticated using (user_id=auth.uid());
create policy "Staff view audit" on public.apex_audit for select to authenticated using (public.apex_is_staff());
-- Atomic optimistic update; avoids silently overwriting another member's change.
create or replace function public.apex_update_asset(p_id text,p_expected_revision bigint,p_patch jsonb)
returns public.apex_assets language plpgsql security definer set search_path = '' as $$
declare rec public.apex_assets;
begin
 if not public.apex_is_staff() then raise exception 'Not an approved staff member'; end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or
    exists(select 1 from jsonb_object_keys(p_patch) as k where k not in ('model','manufacturer','serial','location','status','condition','notes'))
 then raise exception 'Unsupported field';end if;
 update public.apex_assets set payload=payload||p_patch
 where id=p_id and revision=p_expected_revision returning * into rec;
 if not found then raise exception 'Conflict or asset missing; refresh'; end if;
 return rec;
end $$;
revoke all on function public.apex_update_asset(text,bigint,jsonb) from public;
grant execute on function public.apex_update_asset(text,bigint,jsonb) to authenticated;
