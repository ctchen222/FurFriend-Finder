import express from 'express';
import request from 'supertest';
jest.mock('../../auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('../../db', () => ({ pool: {} }));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));
import { auth } from '../../auth';
import {
    createOrganizationAnimalRouter,
    createPublicOrganizationAnimalRouter,
} from '../../router/organizationAnimalRouter';
import { OrganizationError } from '../../Service/organizations/errors';

const service = {
    list: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    publication: jest.fn(),
    addPhoto: jest.fn(),
    changePhoto: jest.fn(),
    publicList: jest.fn(),
    publicDetail: jest.fn(),
    photo: jest.fn(),
};
const app = express();
app.use(express.json());
app.use(
    '/api/v1/public/organizations/:orgId/animals',
    createPublicOrganizationAnimalRouter(service),
);
app.use(
    '/api/v1/organizations/:orgId/animals',
    createOrganizationAnimalRouter(service),
);
const base = '/api/v1/organizations/org/animals';
beforeEach(() => {
    (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: 'actor' },
    });
    service.create.mockResolvedValue({ id: 'animal' });
    service.photo.mockResolvedValue(Buffer.from('webp-test'));
    service.publicList.mockResolvedValue({ animals: [], nextCursor: null });
});
it('requires a session for private lists but keeps public discovery anonymous', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get(base)).status).toBe(401);
    const response = await request(app).get(
        '/api/v1/public/organizations/org/animals',
    );
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.list).not.toHaveBeenCalled();
});
it('uses the session actor and rejects cross-origin mutations including image uploads', async () => {
    expect(
        (await request(app).post(base).send({ actorId: 'forged' })).status,
    ).toBe(201);
    expect(service.create).toHaveBeenCalledWith('actor', 'org', {
        actorId: 'forged',
    });
    expect(
        (
            await request(app)
                .post(`${base}/animal/photos`)
                .set('Origin', 'https://attacker.invalid')
                .set('Content-Type', 'image/png')
                .send(Buffer.from('fake'))
        ).status,
    ).toBe(403);
    expect(service.addPhoto).not.toHaveBeenCalled();
});
it('passes raw image bytes and the expected version after authentication', async () => {
    const bytes = Buffer.from('test');
    expect(
        (
            await request(app)
                .post(`${base}/animal/photos`)
                .set('Content-Type', 'image/png')
                .set('X-Animal-Version', '3')
                .send(bytes)
        ).status,
    ).toBe(201);
    expect(service.addPhoto).toHaveBeenCalledWith(
        'actor',
        'org',
        'animal',
        { expectedVersion: 3 },
        bytes,
    );
});
it('bounds uploads and does not call the service for oversized bodies', async () => {
    const result = await request(app)
        .post(`${base}/animal/photos`)
        .set('Content-Type', 'image/png')
        .send(Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(result.status).toBe(413);
    expect(result.body.code).toBe('PHOTO_TOO_LARGE');
    expect(service.addPhoto).not.toHaveBeenCalled();
});
it('keeps photo responses uncached and exposes only safe errors', async () => {
    const response = await request(app).get(
        '/api/v1/public/organizations/org/animals/animal/photos/photo',
    );
    expect(service.photo).toHaveBeenCalledWith(null, 'org', 'animal', 'photo');
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
    service.photo.mockRejectedValue(
        new OrganizationError(404, 'ANIMAL_LISTING_NOT_FOUND', '找不到動物'),
    );
    expect((await request(app).get(`${base}/animal/photos/photo`)).status).toBe(
        404,
    );
    service.update.mockRejectedValue(new Error('secret database details'));
    const failed = await request(app).patch(`${base}/animal`).send({});
    expect(failed.status).toBe(500);
    expect(failed.text).not.toContain('secret');
});
