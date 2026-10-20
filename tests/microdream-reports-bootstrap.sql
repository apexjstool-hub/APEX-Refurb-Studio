-- Isolated CI database only. Never apply this fixture to a user database.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table if not exists public.apex_staff(user_id uuid primary key,active boolean not null default true);
insert into public.apex_staff(user_id,active) values('11111111-1111-4111-8111-111111111111',true) on conflict(user_id) do nothing;
create or replace function public.apex_is_staff() returns boolean language sql stable set search_path='' as $$select exists(select 1 from public.apex_staff where user_id=auth.uid() and active=true)$$;
