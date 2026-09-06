import NotificationRepository from '../../../repository/notification.db';

describe('NotificationRepository', () => {
    it('deduplicates notification enqueue by run and user', async () => {
        const query = jest.fn().mockResolvedValue({ rows: [{ id: 'n-1' }] });
        const repository = new NotificationRepository({ query } as any);

        await expect(repository.enqueue({ runId: 'run-1', reportId: 7, userId: 'user-1' }))
            .resolves.toBe('n-1');
        expect(query.mock.calls[0][0]).toContain('ON CONFLICT (dedupe_key) DO NOTHING');
        expect(query.mock.calls[0][1]).toEqual(['run-1', 7, 'user-1', 'MATCH_NOTICE:run-1:user-1']);
    });

    it('loads candidates in stable rank order', async () => {
        const query = jest.fn().mockResolvedValue({ rows: [{ candidate: { id: 2 } }, { candidate: { id: 1 } }] });
        const repository = new NotificationRepository({ query } as any);

        await expect(repository.loadCandidates('run-1')).resolves.toEqual([{ id: 2 }, { id: 1 }]);
        expect(query.mock.calls[0][0]).toContain('ORDER BY rank ASC');
    });
});
