import 'dotenv/config';
import { Pool } from 'pg';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
new MigrationRunner(pool, loadMigrationFiles()).migrate()
    .then((applied) => console.log(`Applied ${applied} migration(s).`))
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => pool.end());
