-- ============================================================
-- JAVA LIBRARY · platform schema  (run ONCE in Supabase SQL Editor)
-- Part 1/3 · profiles, roles, auth bootstrap
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  role         text not null default 'reader'
               check (role in ('reader','publisher','admin')),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name',
                   split_part(new.email,'@',1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Part 2/3 · catalog, plans, subscriptions, progress
-- ============================================================
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null check (slug ~ '^[a-z0-9-]+$'),
  title       text not null,
  subtitle    text not null default '',
  author      text not null default '',
  cover_emoji text not null default '📕',
  tier        text not null default 'free' check (tier in ('free','premium')),
  published   boolean not null default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.book_parts (
  id      uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  part_id text not null,
  label   text not null,
  color   text not null default '#888888',
  ord     int  not null,
  unique (book_id, part_id)
);

create table if not exists public.chapters (
  id      uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  num     int  not null,
  part_id text not null,
  title   text not null,
  idx     int  not null,
  unique (book_id, num),
  unique (book_id, idx)
);

create table if not exists public.spreads (
  book_id  uuid not null references public.books(id) on delete cascade,
  idx      int  not null,
  l_kicker text not null default '',
  l_head   text not null default '',
  l_html   text not null,
  r_kicker text not null default '',
  r_head   text not null default '',
  r_html   text not null,
  primary key (book_id, idx),
  l_plain text generated always as (regexp_replace(l_html,'<[^>]+>',' ','g')) stored,
  r_plain text generated always as (regexp_replace(r_html,'<[^>]+>',' ','g')) stored
);

create table if not exists public.plans (
  plan_id       text primary key,
  name          text not null,
  price_paise   int  not null default 0,
  interval_days int  not null default 0,
  features      jsonb not null default '[]'::jsonb
);
insert into public.plans (plan_id,name,price_paise,interval_days,features) values
 ('free','Free Forever',0,0,
  '["Browse catalog","Read every FREE book","Synced reading progress"]'::jsonb),
 ('premium_monthly','Premium Monthly',19900,30,
  '["All PREMIUM books unlocked","Full-text search","New releases first"]'::jsonb),
 ('premium_yearly','Premium Yearly',149900,365,
  '["Everything in Monthly","2 months free"]'::jsonb)
on conflict (plan_id) do nothing;

create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       text not null references public.plans(plan_id),
  status        text not null default 'active'
                check (status in ('active','canceled','expired')),
  provider      text not null default 'sandbox'
                check (provider in ('sandbox','stripe','razorpay')),
  provider_ref  text,
  current_start timestamptz not null default now(),
  current_end   timestamptz not null,
  created_at    timestamptz not null default now(),
  canceled_at   timestamptz
);
create unique index if not exists subs_one_active
  on public.subscriptions(user_id) where status = 'active';
create index if not exists subs_user_idx on public.subscriptions(user_id);

create table if not exists public.reading_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id)    on delete cascade,
  flips      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- ============================================================
-- Part 3/3 · entitlement engine · RLS · search RPC
-- ============================================================
create or replace function public.has_book_access(target_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    exists (select 1 from public.profiles pr
            where pr.id = auth.uid()
              and pr.role in ('admin','publisher'))
    or exists (select 1 from public.books b
               where b.id = target_book and b.published and b.tier = 'free')
    or (exists (select 1 from public.books b
                where b.id = target_book and b.published)
        and exists (select 1 from public.subscriptions s
                    where s.user_id = auth.uid()
                      and s.status = 'active'
                      and s.current_end > now()))
  ), false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select true from public.profiles
                   where id = auth.uid()
                     and role in ('admin','publisher')), false);
$$;

alter table public.profiles         enable row level security;
alter table public.books            enable row level security;
alter table public.book_parts       enable row level security;
alter table public.chapters         enable row level security;
alter table public.spreads          enable row level security;
alter table public.plans            enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.reading_progress enable row level security;

drop policy if exists p_profiles_read   on public.profiles;
drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_read   on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy p_profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_books_read   on public.books;
drop policy if exists p_books_write  on public.books;
create policy p_books_read  on public.books
  for select using (published or public.is_staff());
create policy p_books_write on public.books
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists p_parts_read   on public.book_parts;
drop policy if exists p_parts_write  on public.book_parts;
create policy p_parts_read  on public.book_parts
  for select using (exists (select 1 from public.books b
    where b.id = book_id and b.published) or public.is_staff());
create policy p_parts_write on public.book_parts
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists p_ch_read   on public.chapters;
drop policy if exists p_ch_write  on public.chapters;
create policy p_ch_read  on public.chapters
  for select using (exists (select 1 from public.books b
    where b.id = book_id and b.published
      and public.has_book_access(b.id)) or public.is_staff());
create policy p_ch_write on public.chapters
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists p_spreads_read   on public.spreads;
drop policy if exists p_spreads_write  on public.spreads;
create policy p_spreads_read  on public.spreads
  for select using (exists (select 1 from public.books b
    where b.id = book_id and b.published
      and public.has_book_access(b.id)) or public.is_staff());
create policy p_spreads_write on public.spreads
  for all using (public.is_staff()) with check (public.is_staff());

-- plans world-readable; subscriptions owner-read ONLY (writes via server) --
drop policy if exists p_plans_read on public.plans;
create policy p_plans_read on public.plans for select using (true);

drop policy if exists p_subs_read on public.subscriptions;
create policy p_subs_read on public.subscriptions
  for select using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policies ⇒ client-side writes blocked by design

drop policy if exists p_prog_all on public.reading_progress;
create policy p_prog_all on public.reading_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- SEARCH RPC — security invoker ⇒ caller's RLS applies
-- ============================================================
create index if not exists spreads_fts_idx on public.spreads
  using gin ((to_tsvector('simple',
      coalesce(l_plain,'') || ' ' || coalesce(r_plain,''))));

create or replace function public.search_spread_content(
  p_book uuid, q text, lim int default 22)
returns table (idx int, ln text, rn text)
language sql stable security invoker as $$
  select s.idx,
    ts_headline('simple', s.l_plain,
      websearch_to_tsquery('simple', q),
      'StartSel=<b>,StopSel=</b>,MaxFragments=1,MaxWords=16,MinWords=6'),
    ts_headline('simple', s.r_plain,
      websearch_to_tsquery('simple', q),
      'StartSel=<b>,StopSel=</b>,MaxFragments=1,MaxWords=16,MinWords=6')
  from public.spreads s
  where s.book_id = p_book
    and to_tsvector('simple',
          coalesce(s.l_plain,'') || ' ' || coalesce(s.r_plain,''))
        @@ websearch_to_tsquery('simple', q)
  order by ts_rank(to_tsvector('simple',
          coalesce(s.l_plain,'') || ' ' || coalesce(s.r_plain,'')),
        websearch_to_tsquery('simple', q)) desc
  limit least(greatest(coalesce(lim,22),1),30);
$$;

grant usage on schema public to anon, authenticated;
grant select on public.plans, public.books, public.book_parts,
  public.chapters, public.spreads to anon, authenticated;
grant select on public.profiles, public.subscriptions,
  public.reading_progress to authenticated;
