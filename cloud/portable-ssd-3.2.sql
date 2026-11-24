-- APEX Cloud Connect 3.2: execute only after backup and review.
-- No public Data API access to device keys, nonce table or administration.
create table if not exists public.apex_portable_devices (
 device_id uuid primary key,
 label text not null check (char_length(label) between 1 and 80),
 public_key text not null check (char_length(public_key) between 100 and 1000),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 last_used_at timestamptz
);
create table if not exists public.apex_portable_challenges (
 nonce uuid primary key,
 device_id uuid not null references public.apex_portable_devices(device_id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 used_at timestamptz
);
create index if not exists apex_portable_challenges_expiry_idx on public.apex_portable_challenges(expires_at);
alter table public.apex_portable_devices enable row level security;
alter table public.apex_portable_challenges enable row level security;
revoke all on table public.apex_portable_devices,public.apex_portable_challenges from anon,authenticated,public;
-- Edge Function uses a server-side service-role credential; never embed it in Diagnostics.
