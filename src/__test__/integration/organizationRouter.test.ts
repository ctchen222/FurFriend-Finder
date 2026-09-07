import express from 'express';
import request from 'supertest';
import { z } from 'zod';

jest.mock('../../auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('../../db', () => ({ pool: {} }));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

import { auth } from '../../auth';
import {
    createOrganizationActionRouter,
    createOrganizationRouter,
} from '../../router/organizationRouter';
import { OrganizationError } from '../../Service/organizations/errors';

const organizationId = '11111111-1111-4111-8111-111111111111';
const organization = {
    id: organizationId,
    name: '小橘中途',
    role: 'OWNER',
    reviewStatus: 'PENDING',
};
const service = { create: jest.fn(), listMine: jest.fn(), detail: jest.fn() };
const membership = {
    list: jest.fn(),
    invite: jest.fn(),
    resendInvitation: jest.fn(),
    revokeInvitation: jest.fn(),
    invitationDetail: jest.fn(),
    respondInvitation: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    createTransfer: jest.fn(),
    revokeTransfer: jest.fn(),
    transferDetail: jest.fn(),
    respondTransfer: jest.fn(),
};
const profile = {
    detail: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
};
const app = express();
app.use(express.json());
app.use('/api/v1', createOrganizationActionRouter(membership));
app.use(
    '/api/v1/organizations',
    createOrganizationRouter(service, membership, profile),
);

beforeEach(() => {
    (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: 'actor' },
    });
    service.create.mockResolvedValue(organization);
    service.listMine.mockResolvedValue({
        organizations: [organization],
        nextCursor: null,
    });
    service.detail.mockResolvedValue(organization);
    membership.list.mockResolvedValue({
        members: [],
        invitations: [],
        transfer: null,
        capabilities: {},
    });
    membership.invite.mockResolvedValue({ id: organizationId });
    membership.resendInvitation.mockResolvedValue({ id: organizationId });
    membership.invitationDetail.mockResolvedValue({ organizationId });
    membership.respondInvitation.mockResolvedValue({ organizationId });
    membership.updateMember.mockResolvedValue({ userId: 'member' });
    membership.createTransfer.mockResolvedValue({ id: organizationId });
    membership.transferDetail.mockResolvedValue({ organizationId });
    membership.respondTransfer.mockResolvedValue({ organizationId });
    profile.update.mockResolvedValue(organization);
    profile.detail.mockResolvedValue(organization);
    profile.publish.mockResolvedValue(organization);
    profile.unpublish.mockResolvedValue(organization);
});

describe('private organization HTTP boundary', () => {
    it('requires a real session, not a userId in the body', async () => {
        (auth.api.getSession as jest.Mock).mockResolvedValue(null);
        const response = await request(app)
            .post('/api/v1/organizations')
            .send({ userId: 'actor' });
        expect(response.status).toBe(401);
        expect(service.create).not.toHaveBeenCalled();
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('rejects cross-origin writes', async () => {
        const response = await request(app)
            .post('/api/v1/organizations')
            .set('Origin', 'https://attacker.invalid')
            .send({});
        expect(response.status).toBe(403);
        expect(service.create).not.toHaveBeenCalled();
    });
    it('uses the authenticated actor when creating an organization', async () => {
        const input = {
            requestId: organizationId,
            name: '小橘中途',
            type: 'INDIVIDUAL',
        };
        const response = await request(app)
            .post('/api/v1/organizations')
            .send(input);
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ organization });
        expect(service.create).toHaveBeenCalledWith('actor', input);
    });
    it('returns only the authenticated actor workspace list with no-store', async () => {
        const response = await request(app).get(
            '/api/v1/organizations?pageSize=2',
        );
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            organizations: [organization],
            nextCursor: null,
        });
        expect(service.listMine).toHaveBeenCalledWith('actor', {
            pageSize: '2',
        });
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('uses the request-local organization ID for detail', async () => {
        const response = await request(app).get(
            `/api/v1/organizations/${organizationId}`,
        );
        expect(response.status).toBe(200);
        expect(service.detail).toHaveBeenCalledWith('actor', organizationId);
    });
    it.each([403, 404, 409])(
        'preserves domain rejection %s',
        async (status) => {
            service.detail.mockRejectedValue(
                new OrganizationError(status, 'DENIED', '無法讀取'),
            );
            const response = await request(app).get(
                `/api/v1/organizations/${organizationId}`,
            );
            expect(response.status).toBe(status);
            expect(response.body).toEqual({
                code: 'DENIED',
                message: '無法讀取',
            });
        },
    );
    it('reports invalid input without echoing the submitted values', async () => {
        const error = z.string().safeParse(123);
        if (error.success) throw new Error('expected fixture validation error');
        service.create.mockRejectedValue(error.error);
        const response = await request(app)
            .post('/api/v1/organizations')
            .send({});
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('VALIDATION_ERROR');
        expect(response.body).not.toHaveProperty('stack');
    });
    it('does not leak database failures', async () => {
        service.listMine.mockRejectedValue(
            new Error('private database information'),
        );
        const response = await request(app).get('/api/v1/organizations');
        expect(response.status).toBe(500);
        expect(response.text).not.toContain('private database information');
        expect(response.body.code).toBe('ORGANIZATION_ERROR');
    });
    it('returns JSON 404 for unknown organization subroutes', async () => {
        const response = await request(app).get(
            `/api/v1/organizations/${organizationId}/unknown`,
        );
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('NOT_FOUND');
    });

    it('maps member listing and invitation mutations to the authenticated actor', async () => {
        expect(
            (
                await request(app).get(
                    `/api/v1/organizations/${organizationId}/members`,
                )
            ).status,
        ).toBe(200);
        const invited = await request(app)
            .post(`/api/v1/organizations/${organizationId}/invitations`)
            .send({ email: 'helper@example.com', role: 'EDITOR' });
        expect(invited.status).toBe(201);
        expect(membership.list).toHaveBeenCalledWith('actor', organizationId);
        expect(membership.invite).toHaveBeenCalledWith(
            'actor',
            organizationId,
            { email: 'helper@example.com', role: 'EDITOR' },
        );

        const resent = await request(app).post(
            `/api/v1/organizations/${organizationId}/invitations/${organizationId}/resend`,
        );
        expect(resent.status).toBe(201);
        expect(membership.resendInvitation).toHaveBeenCalledWith(
            'actor',
            organizationId,
            organizationId,
        );
    });

    it('maps role, removal, and ownership mutations without accepting a body actor', async () => {
        expect(
            (
                await request(app)
                    .patch(
                        `/api/v1/organizations/${organizationId}/members/member`,
                    )
                    .send({ role: 'EDITOR', userId: 'forged' })
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app).post(
                    `/api/v1/organizations/${organizationId}/members/member/remove`,
                )
            ).status,
        ).toBe(204);
        expect(
            (
                await request(app)
                    .post(
                        `/api/v1/organizations/${organizationId}/ownership-transfers`,
                    )
                    .send({ toUserId: 'member' })
            ).status,
        ).toBe(201);
        expect(membership.updateMember).toHaveBeenCalledWith(
            'actor',
            organizationId,
            'member',
            { role: 'EDITOR', userId: 'forged' },
        );
        expect(membership.removeMember).toHaveBeenCalledWith(
            'actor',
            organizationId,
            'member',
        );
        expect(membership.createTransfer).toHaveBeenCalledWith(
            'actor',
            organizationId,
            { toUserId: 'member' },
        );
    });

    it('maps profile and publication changes to the authenticated actor', async () => {
        const body = { expectedVersion: 2 };
        expect(
            (
                await request(app).get(
                    `/api/v1/organizations/${organizationId}/profile`,
                )
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .patch(`/api/v1/organizations/${organizationId}/profile`)
                    .send(body)
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .post(
                        `/api/v1/organizations/${organizationId}/publications`,
                    )
                    .send(body)
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .delete(
                        `/api/v1/organizations/${organizationId}/publications`,
                    )
                    .send(body)
            ).status,
        ).toBe(200);
        expect(profile.update).toHaveBeenCalledWith(
            'actor',
            organizationId,
            body,
        );
        expect(profile.detail).toHaveBeenCalledWith('actor', organizationId);
        expect(profile.publish).toHaveBeenCalledWith(
            'actor',
            organizationId,
            body,
        );
        expect(profile.unpublish).toHaveBeenCalledWith(
            'actor',
            organizationId,
            body,
        );
    });

    it('maps token responses and rejects cross-origin acceptance', async () => {
        const token = 'a'.repeat(40);
        expect(
            (
                await request(app).get(
                    `/api/v1/organization-invitations/${token}`,
                )
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app).post(
                    `/api/v1/organization-invitations/${token}/accept`,
                )
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app).post(
                    `/api/v1/organization-ownership-transfers/${token}/decline`,
                )
            ).status,
        ).toBe(200);
        expect(
            (
                await request(app)
                    .post(`/api/v1/organization-invitations/${token}/accept`)
                    .set('Origin', 'https://attacker.invalid')
            ).status,
        ).toBe(403);
        expect(membership.respondInvitation).toHaveBeenCalledWith(
            'actor',
            token,
            'ACCEPTED',
        );
        expect(membership.respondTransfer).toHaveBeenCalledWith(
            'actor',
            token,
            'DECLINED',
        );
    });
});
