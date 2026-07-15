-- Align migration history with the live Supabase default on
-- profiles.auth_user_id (auth.uid()).
--
-- Shadow-database safe: `prisma migrate dev` replays every migration on a fresh
-- Postgres shadow DB that has no Supabase `auth` schema, so referencing
-- auth.uid() there would fail. We create the schema + a stub function ONLY when
-- absent. On the real Supabase database both already exist, so the guards skip
-- and the genuine auth.uid() is preserved untouched. The final ALTER is
-- idempotent (the column already carries this default in production).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$';
  END IF;
END $$;

ALTER TABLE "profiles" ALTER COLUMN "auth_user_id" SET DEFAULT auth.uid();
