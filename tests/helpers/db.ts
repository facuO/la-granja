import pg from "pg";

function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL must be set for tests (e.g. postgres://postgres:postgres@localhost:5433/sofi_tutor_test)"
    );
  }
  return base.replace(/\/[^/]+$/, "/sofi_tutor_test");
}

const { Pool } = pg;

export const testPool = new Pool({
  connectionString: testDatabaseUrl(),
  max: 5,
});

export async function resetDb(): Promise<void> {
  await testPool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function closeTestPool(): Promise<void> {
  await testPool.end();
}
