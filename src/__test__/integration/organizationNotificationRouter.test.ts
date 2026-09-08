import express from 'express';
import request from 'supertest';
jest.mock('../../auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('../../db', () => ({ pool: {} }));
import { auth } from '../../auth';
import { createOrganizationNotificationRouter } from '../../router/organizationNotificationRouter';
const service = { list: jest.fn(), read: jest.fn() };
const app = express();
app.use(express.json(), createOrganizationNotificationRouter(service));
beforeEach(() => {
    jest.clearAllMocks();
    (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: 'owner' },
    });
    service.list.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
        nextCursor: null,
    });
});
it('requires authentication and never takes recipient identity from the client', async () => {
    const result = await request(app).get('/?userId=other');
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.list).toHaveBeenCalledWith('owner', { userId: 'other' });
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get('/')).status).toBe(401);
});
it('marks read using the session owner and rejects cross-origin writes', async () => {
    expect(
        (await request(app).post('/notice/read').send({ userId: 'other' }))
            .status,
    ).toBe(204);
    expect(service.read).toHaveBeenCalledWith('owner', 'notice');
    service.read.mockClear();
    expect(
        (
            await request(app)
                .post('/notice/read')
                .set('Origin', 'https://evil.test')
                .send({})
        ).status,
    ).toBe(403);
    expect(service.read).not.toHaveBeenCalled();
});
