import { MigrationRunner, type MigrationFile } from '../../libs/migrationRunner';

function migration(version: number): MigrationFile { return { version, name: `migration-${version}`, sql: `SELECT ${version}`, checksum: `checksum-${version}` }; }

describe('MigrationRunner', () => {
    it.each([false, true])('destroys the connection on unlock failure and preserves migration failure: %s', async (migrationFails) => {
        const migrationError = new Error('migration failed');
        const unlockError = new Error('unlock failed');
        const client = { query: jest.fn(async (sql: string) => {
            if (sql.includes('pg_advisory_unlock')) throw unlockError;
            if (sql === 'SELECT 1' && migrationFails) throw migrationError;
            return { rows: [] };
        }), release: jest.fn() } as any;
        const pool = { query: jest.fn(), connect: jest.fn().mockResolvedValue(client) } as any;

        await expect(new MigrationRunner(pool, [migration(1)]).migrate())
            .rejects.toBe(migrationFails ? migrationError : unlockError);
        expect(client.release).toHaveBeenCalledTimes(1);
        expect(client.release).toHaveBeenCalledWith(true);
    });

    it('applies pending migrations in order and is idempotent', async () => {
        const rows = new Map<number, string>(); const appliedSql: string[] = [];
        const client = { query: jest.fn(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT checksum')) return { rows: rows.has(params![0]) ? [{ checksum: rows.get(params![0]) }] : [] };
            if (sql.startsWith('INSERT INTO schema_migrations')) rows.set(params![0], params![2]);
            if (/^SELECT \d+$/.test(sql)) appliedSql.push(sql);
            return { rows: [], rowCount: 1 };
        }), release: jest.fn() } as any;
        const pool = { query: jest.fn().mockResolvedValue({ rows: [] }), connect: jest.fn().mockResolvedValue(client) } as any;
        const runner = new MigrationRunner(pool, [migration(2), migration(1)]);
        await expect(runner.migrate()).resolves.toBe(2);
        await expect(runner.migrate()).resolves.toBe(0);
        expect(appliedSql).toEqual(['SELECT 1', 'SELECT 2']);
        expect(pool.query).not.toHaveBeenCalled();
        expect(pool.connect).toHaveBeenCalledTimes(2);
        expect(client.release).toHaveBeenCalledTimes(2);
    });

    it('fails closed when an applied migration is edited', async () => {
        const client = { query: jest.fn(async (sql: string) => sql.includes('SELECT checksum') ? { rows: [{ checksum: 'old' }] } : { rows: [] }), release: jest.fn() } as any;
        const pool = { query: jest.fn().mockResolvedValue({ rows: [] }), connect: jest.fn().mockResolvedValue(client) } as any;
        await expect(new MigrationRunner(pool, [migration(1)]).migrate()).rejects.toThrow('Migration checksum mismatch for V1');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
});
