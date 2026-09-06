import AnimalRepository from '../../repository/animal.db';
import { pool } from '../../db';
jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

describe('shelter selection queries', () => {
    it('filters exact shelter identity before cursor ordering', async () => {
        (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
        await new AnimalRepository().findAllWithShelter(12, undefined, undefined, { shelterId: 42, city: '臺北市' });
        const [sql, values] = (pool.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('animal.animal_shelter_id = $');
        expect(sql.indexOf('animal.animal_shelter_id = $')).toBeLessThan(sql.indexOf('ORDER BY'));
        expect(values).toContain(42);
    });
    it('offers bounded shelter metadata, not animal IDs or private organization data', async () => {
        const rows = [{ id: 42, name: '測試收容所', address: '臺北市', tel: '02-1234' }];
        (pool.query as jest.Mock).mockResolvedValue({ rows });
        expect(await new AnimalRepository().listShelters()).toEqual(rows);
        const [sql] = (pool.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('animal_shelter');
        expect(sql).toContain('LIMIT 501');
    });
});
