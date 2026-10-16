create schema auth;
create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
grant usage on schema auth to authenticated;
