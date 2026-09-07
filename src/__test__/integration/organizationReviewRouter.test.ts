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
    createOrganizationReviewRouter,
    createPublicOrganizationRouter,
} from '../../router/organizationReviewRouter';

const id = '11111111-1111-4111-8111-111111111111';
const organization = { id, name: '小橘中途', version: 3 };
const reviewService = {
    list: jest.fn(),
    review: jest.fn(),
    moderate: jest.fn(),
};
const publicService = { list: jest.fn(), detail: jest.fn() };
const app = express();
app.use(express.json());
app.use(
    '/api/v1/public/organizations',
    createPublicOrganizationRouter(publicService),
);
app.use(
    '/api/v1/reviewer/organizations',
    createOrganizationReviewRouter(reviewService),
);

beforeEach(() => {
    jest.clearAllMocks();
    (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: 'reviewer' },
    });
    reviewService.list.mockResolvedValue({
        organizations: [organization],
        nextCursor: null,
    });
    reviewService.review.mockResolvedValue(organization);
    reviewService.moderate.mockResolvedValue(organization);
    publicService.list.mockResolvedValue({
        organizations: [organization],
        nextCursor: null,
    });
    publicService.detail.mockResolvedValue(organization);
});

describe('organization review and public HTTP boundaries', () => {
    it('keeps public projections available without a session', async () => {
        (auth.api.getSession as jest.Mock).mockResolvedValue(null);
        const list = await request(app).get(
            '/api/v1/public/organizations?q=小橘',
        );
        const detail = await request(app).get(
            `/api/v1/public/organizations/${id}`,
        );
        expect(list.status).toBe(200);
        expect(detail.status).toBe(200);
        expect(publicService.list).toHaveBeenCalledWith({ q: '小橘' });
        expect(publicService.detail).toHaveBeenCalledWith(id);
        expect(list.headers['cache-control']).toBe(
            'public, max-age=0, must-revalidate',
        );
    });

    it('requires a session for the reviewer queue', async () => {
        (auth.api.getSession as jest.Mock).mockResolvedValue(null);
        const response = await request(app).get(
            '/api/v1/reviewer/organizations',
        );
        expect(response.status).toBe(401);
        expect(reviewService.list).not.toHaveBeenCalled();
        expect(response.headers['cache-control']).toBe('no-store');
    });

    it('maps review and moderation without accepting a body reviewer', async () => {
        const decision = {
            expectedVersion: 3,
            decision: 'APPROVED',
            reviewerId: 'forged',
        };
        const moderation = { expectedVersion: 4, reason: '違反平台規範' };
        expect(
            (
                await request(app)
                    .post(`/api/v1/reviewer/organizations/${id}/reviews`)
                    .send(decision)
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .post(`/api/v1/reviewer/organizations/${id}/suspensions`)
                    .send(moderation)
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .post(`/api/v1/reviewer/organizations/${id}/reactivations`)
                    .send(moderation)
            ).status,
        ).toBe(200);
        expect(reviewService.review).toHaveBeenCalledWith(
            'reviewer',
            id,
            decision,
        );
        expect(reviewService.moderate).toHaveBeenNthCalledWith(
            1,
            'reviewer',
            id,
            moderation,
            'SUSPENDED',
        );
        expect(reviewService.moderate).toHaveBeenNthCalledWith(
            2,
            'reviewer',
            id,
            moderation,
            'REACTIVATED',
        );
    });

    it('rejects cross-origin reviewer mutations', async () => {
        const response = await request(app)
            .post(`/api/v1/reviewer/organizations/${id}/reviews`)
            .set('Origin', 'https://attacker.invalid')
            .send({ expectedVersion: 3, decision: 'APPROVED' });
        expect(response.status).toBe(403);
        expect(reviewService.review).not.toHaveBeenCalled();
    });
});
