-- ============================================================
-- JAVA LIBRARY · migration 003 (run ONCE in Supabase SQL Editor,
-- AFTER migration 002)
-- Adds a single-row admin-editable SMTP config, used by the Node
-- server to send app-originated emails (e.g. the learning-reminder
-- feature). This is UNRELATED to Supabase Auth's own confirmation/
-- reset emails — those are configured only in the Supabase Dashboard
-- (Authentication → Settings → SMTP Settings) and cannot be
-- influenced from this table.
-- Additive + idempotent, same conventions as schema.sql / 002.
-- ============================================================

create table if not exists public.smtp_settings (
  id          int primary key default 1 check (id = 1),  -- singleton row
  host        text not null,
  port        int not null check (port between 1 and 65535),
  secure      boolean not null default false,             -- true = implicit TLS (465), false = STARTTLS (587/25)
  username    text not null,
  password    text not null,                              -- app password / SMTP secret — never sent back to the client, see admin.js
  from_email  text not null,
  from_name   text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- Service-role only (mirrors public.plans / public.subscriptions): all
-- reads/writes happen through the `admin` client in server/src/routes,
-- gated by adminGate. No RLS policy is added on purpose — with none,
-- RLS enabled + revoke-all denies every row to anon/authenticated
-- outright, and the service-role client bypasses RLS entirely anyway.
alter table public.smtp_settings enable row level security;
revoke all on public.smtp_settings from anon, authenticated;
