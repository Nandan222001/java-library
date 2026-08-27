-- ============================================================
-- JAVA LIBRARY · migration 002 (run ONCE in Supabase SQL Editor,
-- AFTER schema.sql)
-- Adds: per-book pricing/purchases, a per-book MCQ practice bank,
-- and gamification (points/streaks/badges).
-- Additive + idempotent, same conventions as schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 0 · Security hardening (independent of the features below)
-- ------------------------------------------------------------
-- p_profiles_update (schema.sql) restricts which ROW a user may update
-- (their own) but not which COLUMN — and Supabase's default per-table
-- grants are broader than the `grant select ...` statements at the
-- bottom of schema.sql suggest. Left as-is, a signed-in reader could
-- call the Supabase REST API directly (same publishable key + their own
-- JWT the app already hands to `req.sb`) and rewrite their OWN
-- `profiles.role` to 'admin', bypassing the Node app entirely.
-- PATCH /api/me only ever needs to change display_name, so restrict the
-- grant to exactly that column; RLS keeps doing the row-scoping.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 1 · Pricing — per-book one-time purchase
-- ------------------------------------------------------------
alter table public.books
  add column if not exists price_paise int not null default 0
    check (price_paise >= 0);
comment on column public.books.price_paise is
  '0 = not sold individually (subscription-only or free)';

create table if not exists public.book_purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  book_id         uuid not null references public.books(id) on delete cascade,
  price_paise_paid int not null,
  provider        text not null default 'sandbox'
                  check (provider in ('sandbox','stripe','razorpay','admin_grant')),
  provider_ref    text,
  purchased_at    timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists purchases_user_idx on public.book_purchases(user_id);

alter table public.book_purchases enable row level security;
drop policy if exists p_purchases_read on public.book_purchases;
create policy p_purchases_read on public.book_purchases
  for select using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policy ⇒ client-side writes blocked by design,
-- same convention as public.subscriptions
revoke all on public.book_purchases from anon, authenticated;
grant select on public.book_purchases to authenticated;

-- has_book_access() now also honors a one-time purchase
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
    or (exists (select 1 from public.books b
                where b.id = target_book and b.published)
        and exists (select 1 from public.subscriptions s
                    where s.user_id = auth.uid()
                      and s.status = 'active'
                      and s.current_end > now()))
  ), false);
$$;

-- ------------------------------------------------------------
-- 2 · MCQ practice bank — standalone per book, not tied to chapters
-- ------------------------------------------------------------
create table if not exists public.practice_questions (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books(id) on delete cascade,
  question     text not null,
  options      jsonb not null,              -- array of option strings
  correct_index int not null,
  explanation  text not null default '',
  difficulty   text not null default 'medium'
               check (difficulty in ('easy','medium','hard')),
  created_at   timestamptz not null default now()
);
create index if not exists practice_q_book_idx on public.practice_questions(book_id);

alter table public.practice_questions enable row level security;
drop policy if exists p_practice_q_read  on public.practice_questions;
drop policy if exists p_practice_q_write on public.practice_questions;
create policy p_practice_q_read on public.practice_questions
  for select using (exists (select 1 from public.books b
    where b.id = book_id and b.published
      and public.has_book_access(b.id)) or public.is_staff());
create policy p_practice_q_write on public.practice_questions
  for all using (public.is_staff()) with check (public.is_staff());

-- Column-level grant, not just RLS: correct_index/explanation are the
-- answer key. RLS gates ROWS, not columns — a book-entitled reader could
-- otherwise `select correct_index` directly via the REST API and read
-- every answer, Node route or not. Only admin/service-role (which
-- bypasses grants) can see those two columns; the grading route uses it.
revoke all on public.practice_questions from anon, authenticated;
grant select (id, book_id, question, options, difficulty, created_at)
  on public.practice_questions to authenticated;

create table if not exists public.practice_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  question_id   uuid not null references public.practice_questions(id) on delete cascade,
  book_id       uuid not null references public.books(id) on delete cascade,
  selected_index int not null,
  correct       boolean not null,
  created_at    timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.practice_attempts(user_id);

alter table public.practice_attempts enable row level security;
drop policy if exists p_attempts_read on public.practice_attempts;
create policy p_attempts_read on public.practice_attempts
  for select using (user_id = auth.uid() or public.is_staff());
-- no write policy ⇒ server-only via service-role (grading route)
revoke all on public.practice_attempts from anon, authenticated;
grant select on public.practice_attempts to authenticated;

-- ------------------------------------------------------------
-- 3 · Gamification — points, streaks, badges, leaderboard
-- ------------------------------------------------------------
-- Deliberately NOT columns on public.profiles: that table's RLS only
-- row-scopes updates (see section 0), so a denormalized counter there
-- would inherit the same self-write exposure. A dedicated table with NO
-- client write policy at all is the safer + more consistent choice
-- (matches subscriptions/book_purchases/practice_attempts).
create table if not exists public.player_stats (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  points          int not null default 0,
  current_streak  int not null default 0,
  longest_streak  int not null default 0,
  last_active_date date,
  updated_at      timestamptz not null default now()
);

alter table public.player_stats enable row level security;
drop policy if exists p_stats_read on public.player_stats;
create policy p_stats_read on public.player_stats
  for select using (user_id = auth.uid() or public.is_staff());
-- no write policy ⇒ server-only via the two RPCs below (security definer),
-- called only from the Node service-role client. The leaderboard route
-- also reads this via the service-role client, so this row-scoped RLS
-- does not block cross-user leaderboard reads.
revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to authenticated;

-- Audit log AND the actual dedup mechanism for one-time awards: a real
-- ref_id column (not a jsonb path) makes `unique(user_id,kind,ref_id)`
-- do double duty — e.g. kind='quiz_perfect', ref_id=<book_id> means a
-- user can only ever be credited once for a book's first perfect score,
-- no matter how many times the submit route is retried.
create table if not exists public.point_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  points     int not null,
  ref_id     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists point_events_user_idx on public.point_events(user_id);

alter table public.point_events enable row level security;
drop policy if exists p_events_read on public.point_events;
create policy p_events_read on public.point_events
  for select using (user_id = auth.uid() or public.is_staff());
revoke all on public.point_events from anon, authenticated;
grant select on public.point_events to authenticated;

-- Small fixed catalog — no criteria-engine columns. Four rules, hardcoded
-- in server/src/lib/gamification.js; not worth a generic rule DSL yet.
create table if not exists public.badges (
  id          text primary key,
  label       text not null,
  description text not null,
  icon        text not null default '🏅'
);
insert into public.badges (id,label,description,icon) values
 ('first_quiz','First Steps','Completed your first practice quiz','🎯'),
 ('quiz_ace','Quiz Ace','Scored a perfect round on a practice quiz','🏆'),
 ('streak_7','Week Warrior','Kept a 7-day reading streak','🔥'),
 ('point_climber','Point Climber','Earned 100+ points','⭐')
on conflict (id) do nothing;

alter table public.badges enable row level security;
drop policy if exists p_badges_read  on public.badges;
drop policy if exists p_badges_write on public.badges;
create policy p_badges_read on public.badges for select using (true);
create policy p_badges_write on public.badges
  for all using (public.is_staff()) with check (public.is_staff());
revoke all on public.badges from anon, authenticated;
grant select on public.badges to anon, authenticated;   -- world-readable catalog, like plans

create table if not exists public.user_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   text not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
drop policy if exists p_user_badges_read on public.user_badges;
create policy p_user_badges_read on public.user_badges
  for select using (user_id = auth.uid() or public.is_staff());
-- no write policy ⇒ server-only (evaluateBadges(), via service-role)
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

-- touch_streak(): ONE atomic statement (insert ... on conflict do
-- update), not a JS read-then-compute-then-write — this route is
-- plausibly hit by retries/double-taps/multiple tabs, and splitting it
-- into two round trips is a classic lost-update race.
create or replace function public.touch_streak(p_user uuid)
returns table(current_streak int, longest_streak int)
language plpgsql security definer set search_path = public as $$
declare
  today date := current_date;
begin
  insert into public.player_stats (user_id, current_streak, longest_streak, last_active_date)
  values (p_user, 1, 1, today)
  on conflict (user_id) do update set
    current_streak = case
      when public.player_stats.last_active_date = today then public.player_stats.current_streak
      when public.player_stats.last_active_date = today - 1 then public.player_stats.current_streak + 1
      else 1
    end,
    longest_streak = greatest(public.player_stats.longest_streak, case
      when public.player_stats.last_active_date = today then public.player_stats.current_streak
      when public.player_stats.last_active_date = today - 1 then public.player_stats.current_streak + 1
      else 1
    end),
    last_active_date = today,
    updated_at = now();

  return query
    select ps.current_streak, ps.longest_streak
    from public.player_stats ps where ps.user_id = p_user;
end $$;

-- award_points(): inserts the dedup'd event first; only increments the
-- running total if that insert actually happened, so a retried/duplicate
-- award (same user+kind+ref_id) never double-counts.
create or replace function public.award_points(
  p_user uuid, p_kind text, p_points int, p_ref_id text)
returns table(awarded boolean, total_points int)
language plpgsql security definer set search_path = public as $$
declare
  v_rows int;
begin
  insert into public.point_events (user_id, kind, points, ref_id)
  values (p_user, p_kind, p_points, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;
  get diagnostics v_rows = row_count;

  -- always ensure a player_stats row exists; only actually add points
  -- when the event above was newly inserted (v_rows=0 ⇒ duplicate/retry
  -- of an award already credited — add 0 so total_points still resolves)
  insert into public.player_stats (user_id, points)
  values (p_user, case when v_rows > 0 then p_points else 0 end)
  on conflict (user_id) do update set
    points = public.player_stats.points +
             (case when v_rows > 0 then p_points else 0 end),
    updated_at = now();

  return query
    select (v_rows > 0), ps.points
    from public.player_stats ps where ps.user_id = p_user;
end $$;

-- Postgres grants EXECUTE on every new function to PUBLIC by default —
-- confirmed by testing against a real Postgres instance while writing
-- this migration, where `authenticated` could call award_points()
-- directly and self-credit arbitrary points despite no explicit grant
-- ever being added. Omitting a grant is NOT the same as blocking access;
-- these two mutate state and must be explicitly revoked so only the
-- service-role client (used by the audited Node code paths that call
-- them) can invoke them — bypassing grants entirely, same as it bypasses
-- RLS. (Contrast with has_book_access()/is_staff() in schema.sql, which
-- are read-only boolean checks with no side effects — harmless to leave
-- PUBLIC-callable, and left alone here.)
revoke execute on function public.touch_streak(uuid) from public, anon, authenticated;
revoke execute on function public.award_points(uuid, text, int, text) from public, anon, authenticated;
