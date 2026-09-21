-- Shared objects for the keyword search of the private catalog.
-- The file name sorts first, so these objects exist before the tables that use them.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Italian text search configuration that ignores accents.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config
    WHERE cfgname = 'italian_unaccent' AND cfgnamespace = 'public'::regnamespace
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION public.italian_unaccent ( COPY = pg_catalog.italian );
    ALTER TEXT SEARCH CONFIGURATION public.italian_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH public.unaccent, pg_catalog.italian_stem, simple;
  END IF;
END$$;

-- Lowercase, no accents, all dots removed (a.b.c. -> abc), every other
-- non alphanumeric sequence replaced by one space.
-- Declared IMMUTABLE so that generated columns and indexes can use it.
-- The unaccent function and dictionary are schema qualified: the function
-- must give the same result with any search_path, for example during a restore.
CREATE OR REPLACE FUNCTION public.normalize_text(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(
    regexp_replace(
      lower(
        regexp_replace(
          public.unaccent('public.unaccent'::regdictionary, coalesce(t, '')),
          '\.', '', 'g'
        )
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  )
$$;
