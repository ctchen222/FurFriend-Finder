import 'dotenv/config';
import { pool } from '../db';
import OrganizationMailWorker from '../workers/organizationMailWorker';

async function run() {
    const processed = await new OrganizationMailWorker().runOnce();
    console.log(processed ? 'Processed one organization mail job.' : 'No organization mail job was ready.');
}

run()
    .catch((error) => {
        console.error('Organization mail job failed before delivery handling.');
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
