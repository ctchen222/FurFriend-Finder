import { Pool } from 'pg';
import { registerDbPoolGauge } from './config/metrics';

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

registerDbPoolGauge(pool);

export { pool };
