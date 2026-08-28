-- ============================================================
-- JAVA LIBRARY · migration 004 (run ONCE in Supabase SQL Editor,
-- AFTER schema.sql + 002 + 003)
-- Adds: per-user READ-permission grants, a payments ledger that
-- powers the admin sales graphs, and dashboard data hooks.
-- Additive + idempotent, same conventions as earlier migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1 · book_grants — an admin granting a SPECIFIC user READ access
--     to a SPECIFIC book (independent of subscription/purchase).
--     Server-only writes (admin panel), owner+staff can read.
-- ------------------------------------------------------------
create table if not exists public.book_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id)    on delete cascade,
  granted_by uuid references public.profiles(id),
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists grants_user_idx on public.book_grants(user_id);
create index if not exists grants_book_idx on public.book_grants(book_id);

alter table public.book_grants enable row level security;
drop policy if exists p_grants_read on public.book_grants;
create policy p_grants_read on public.book_grants
  for select using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policy ⇒ writes only via the Node API
revoke all on public.book_grants from anon, authenticated;
grant select on public.book_grants to authenticated;

-- ------------------------------------------------------------
-- 2 · payments — the sales ledger. Every captured subscription,
--     one-time book purchase and admin grant lands here so the
--     dashboard can draw revenue/sales graphs without scanning
--     subscriptions + book_purchases + grants in three places.
--     Server-only writes; owner + staff can read.
-- ------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  kind                text not null
                      check (kind in ('subscription','book_purchase','admin_grant')),
  amount_paise        int  not null default 0 check (amount_paise >= 0),
  currency            text not null default 'INR',
  provider            text not null default 'sandbox'
                      check (provider in ('sandbox','stripe','razorpay','admin_grant')),
  provider_ref        text,                 -- sandbox ref / Razorpay ORDER id
  provider_payment_id text,                 -- Razorpay PAYMENT id once captured
  plan_id             text,                 -- populated for subscriptions
  book_id             uuid references public.books(id),   -- populated for purchases
  status              text not null default 'captured'
                      check (status in ('pending','captured','refunded','failed')),
  note                text not null default '',
  created_at          timestamptz not null default now()
);
create index if not exists payments_created_idx on public.payments(created_at desc);
create index if not exists payments_user_idx   on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);

alter table public.payments enable row level security;
drop policy if exists p_payments_read on public.payments;
create policy p_payments_read on public.payments
  for select using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policy ⇒ writes only via the Node API
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

-- ------------------------------------------------------------
-- 3 · has_book_access() now ALSO honors read-permission grants:
--     staff · published free books · one-time purchase ·
--     admin-issued grant · active premium subscription
-- ------------------------------------------------------------
create or replace function public.has_book_access(target_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    exists (select 1 from public.profiles pr
            where pr.id = auth.uid()
              and pr.role in ('admin','publisher'))
    or exists (select 1 from public.books b
               where b.id = target_book and b.published and b.tier = 'free')
    or exists (select 1 from public.book_purchases bp
               where bp.book_id = target_book and bp.user_id = auth.uid())
    or exists (select 1 from public.book_grants bg
               where bg.book_id = target_book and bg.user_id = auth.uid())
    or (exists (select 1 from public.books b
                where b.id = target_book and b.published)
        and exists (select 1 from public.subscriptions s
                    where s.user_id = auth.uid()
                      and s.status = 'active'
                      and s.current_end > now()))
  ), false);
$$;