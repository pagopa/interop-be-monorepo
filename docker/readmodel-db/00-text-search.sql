-- Shared objects for the keyword search of the private catalog.
-- The file name sorts first, so these objects exist before the tables that use them.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Italian text search configuration that ignores accents.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'italian_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.italian_unaccent ( COPY = pg_catalog.italian );
    ALTER TEXT SEARCH CONFIGURATION public.italian_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, pg_catalog.italian_stem, simple;
  END IF;
END$$;

-- Lowercase, no accents, dotted abbreviations collapsed (a.b.c. -> abc),
-- every other non alphanumeric sequence replaced by one space.
-- Declared IMMUTABLE so that it can be used in generated columns and indexes.
CREATE OR REPLACE FUNCTION public.normalize_text(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(
    regexp_replace(
      lower(regexp_replace(unaccent(coalesce(t, '')), '\.', '', 'g')),
      '[^a-z0-9]+', ' ', 'g'
    )
  )
$$;
