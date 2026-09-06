import express from 'express';
import request from 'supertest';
import { z } from 'zod';

jest.mock('../../auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('../../db', () => ({ pool: {} }));
jest.mock('../../config/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));

import { auth } from '../../auth';
import { createOrganizationRouter } from '../../router/organizationRouter';
import { OrganizationError } from '../../Service/organizations/errors';

const organizationId = '11111111-1111-4111-8111-111111111111';
const organization = { id: organizationId, name: '小橘中途', role: 'OWNER', reviewStatus: 'PENDING' };
const service = { create: jest.fn(), listMine: jest.fn(), detail: jest.fn() };
const app = express();
app.use(express.json());
app.use('/api/v1/organizations', createOrganizationRouter(service));

beforeEach(() => {
    (auth.api.getSession as jest.Mock).mockResolvedValue({ user: { id: 'actor' } });
    service.create.mockResolvedValue(organization);
    service.listMine.mockResolvedValue({ organizations: [organization], nextCursor: null });
    service.detail.mockResolvedValue(organization);
});

describe('private organization HTTP boundary', () => {
    it('requires a real session, not a userId in the body', async () => {
        (auth.api.getSession as jest.Mock).mockResolvedValue(null);
        const response = await request(app).post('/api/v1/organizations').send({ userId: 'actor' });
        expect(response.status).toBe(401);
        expect(service.create).not.toHaveBeenCalled();
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('rejects cross-origin writes', async () => {
        const response = await request(app).post('/api/v1/organizations').set('Origin', 'https://attacker.invalid').send({});
        expect(response.status).toBe(403);
        expect(service.create).not.toHaveBeenCalled();
    });
    it('uses the authenticated actor when creating an organization', async () => {
        const input = { requestId: organizationId, name: '小橘中途', type: 'INDIVIDUAL' };
        const response = await request(app).post('/api/v1/organizations').send(input);
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ organization });
        expect(service.create).toHaveBeenCalledWith('actor', input);
    });
    it('returns only the authenticated actor workspace list with no-store', async () => {
        const response = await request(app).get('/api/v1/organizations?pageSize=2');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ organizations: [organization], nextCursor: null });
        expect(service.listMine).toHaveBeenCalledWith('actor', { pageSize: '2' });
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('uses the request-local organization ID for detail', async () => {
        const response = await request(app).get(`/api/v1/organizations/${organizationId}`);
        expect(response.status).toBe(200);
        expect(service.detail).toHaveBeenCalledWith('actor', organizationId);
    });
    it.each([403, 404, 409])('preserves domain rejection %s', async status => {
        service.detail.mockRejectedValue(new OrganizationError(status, 'DENIED', '無法讀取'));
        const response = await request(app).get(`/api/v1/organizations/${organizationId}`);
        expect(response.status).toBe(status);
        expect(response.body).toEqual({ code: 'DENIED', message: '無法讀取' });
    });
    it('reports invalid input without echoing the submitted values', async () => {
        const error = z.string().safeParse(123);
        if (error.success) throw new Error('expected fixture validation error');
        service.create.mockRejectedValue(error.error);
        const response = await request(app).post('/api/v1/organizations').send({});
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('VALIDATION_ERROR');
        expect(response.body).not.toHaveProperty('stack');
    });
    it('does not leak database failures', async () => {
        service.listMine.mockRejectedValue(new Error('private database information'));
        const response = await request(app).get('/api/v1/organizations');
        expect(response.status).toBe(500);
        expect(response.text).not.toContain('private database information');
        expect(response.body.code).toBe('ORGANIZATION_ERROR');
    });
    it('returns JSON 404 for unknown organization subroutes', async () => {
        const response = await request(app).get(`/api/v1/organizations/${organizationId}/unknown`);
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('NOT_FOUND');
    });
});
