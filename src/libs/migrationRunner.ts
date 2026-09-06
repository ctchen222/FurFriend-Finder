import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';

export interface MigrationFile { version: number; name: string; sql: string; checksum: string; }

export function loadMigrationFiles(directory = path.resolve(__dirname, '../../sql')): MigrationFile[] {
    return fs.readdirSync(directory)
        .filter((name) => /^V\d+__.+\.sql$/.test(name))
        .map((name) => {
            const match = name.match(/^V(\d+)__(.+)\.sql$/)!;
            const sql = fs.readFileSync(path.join(directory, name), 'utf8');
            return { version: Number(match[1]), name: match[2], sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
        })
        .sort((left, right) => left.version - right.version);
}

export class MigrationRunner {
    constructor(private readonly pool: Pick<Pool, 'query' | 'connect'>, private readonly migrations: MigrationFile[]) {}

    async migrate(): Promise<number> {
        const client = await this.pool.connect();
        let applied = 0;
        let failure: { error: unknown } | undefined;
        try {
            await client.query("SELECT pg_advisory_lock(hashtext('furfriend-finder-schema'))");
            await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`);
            for (const migration of [...this.migrations].sort((left, right) => left.version - right.version)) {
                try {
                    await client.query('BEGIN');
                    const existing = await client.query<{ checksum: string }>(
                        'SELECT checksum FROM schema_migrations WHERE version = $1', [migration.version]);
                    if (existing.rows[0]) {
                        if (existing.rows[0].checksum !== migration.checksum) throw new Error(`Migration checksum mismatch for V${migration.version}`);
                    } else {
                        await client.query(migration.sql);
                        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [migration.version, migration.name, migration.checksum]);
                        applied += 1;
                    }
                    await client.query('COMMIT');
                } catch (error) {
                    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
                    throw error;
                }
            }
        } catch (error) {
            failure = { error };
        } finally {
            try {
                await client.query("SELECT pg_advisory_unlock(hashtext('furfriend-finder-schema'))");
                client.release();
            } catch (error) {
                client.release(true);
                failure ??= { error };
            }
        }
        if (failure) throw failure.error;
        return applied;
    }
}
