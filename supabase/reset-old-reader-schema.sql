-- ============================================================
-- JAVA LIBRARY · clean up the OLD reader schema BEFORE applying
-- supabase/schema.sql. Run this ONCE in the Supabase SQL Editor.
--
-- Why: the old java-book schema created book_parts / book_chapters /
-- book_spreads. The new library schema reuses the NAME book_parts with a
-- DIFFERENT shape (book_id FK, uuid PK). Postgres 'if not exists' would
-- skip it, leaving the library broken. Drop the old objects first.
-- ============================================================

drop function if exists public.search_spreads(text, int);

drop table if exists public.book_spreads  cascade;
drop table if exists public.book_chapters cascade;
drop table if exists public.book_parts    cascade;

-- also drop the old generated-column FTX index if it somehow survived
drop index if exists public.book_spreads_fts;

-- nothing else was touched. Now run supabase/schema.sql (the LIBRARY one).
