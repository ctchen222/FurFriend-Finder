import { withTransaction } from '../../libs/transaction';

describe('withTransaction', () => {
  it('commits work on one client and releases it', async () => {
    const client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    await withTransaction(pool, async current => {
      await current.query('SELECT 1');
      return 'ok';
    });

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls.map(([sql]: [string]) => sql)).toEqual([
      'BEGIN', 'SELECT 1', 'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and preserves the original error', async () => {
    const error = new Error('write failed');
    const client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    await expect(withTransaction(pool, async current => {
      await current.query('INSERT INTO probe VALUES (1)');
      throw error;
    })).rejects.toBe(error);

    expect(client.query.mock.calls.map(([sql]: [string]) => sql)).toEqual([
      'BEGIN', 'INSERT INTO probe VALUES (1)', 'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
