import { canManageOrganization } from '../../../Service/organizations/policy';
import { createOrganizationSchema, organizationListSchema } from '../../../Service/organizations/validation';

const active = { role: 'OWNER', membershipStatus: 'ACTIVE', operationalStatus: 'ACTIVE', reviewStatus: 'APPROVED' };
const input = { requestId: '11111111-1111-4111-8111-111111111111', name: ' 小橘中途 ', type: 'INDIVIDUAL' };

describe('organization authorization', () => {
    it.each(['OWNER', 'ADMIN', 'EDITOR'])('allows an active %s to read', role => {
        expect(canManageOrganization({ ...active, role }, 'read')).toBe(true);
    });
    it.each(['OWNER', 'ADMIN'])('allows %s to edit the profile', role => {
        expect(canManageOrganization({ ...active, role }, 'editProfile')).toBe(true);
    });
    it('does not allow editors to publish or change the profile', () => {
        expect(canManageOrganization({ ...active, role: 'EDITOR' }, 'publish')).toBe(false);
        expect(canManageOrganization({ ...active, role: 'EDITOR' }, 'editProfile')).toBe(false);
    });
    it.each(['PENDING', 'REJECTED'])('blocks publishing for %s organizations', reviewStatus => {
        expect(canManageOrganization({ ...active, reviewStatus }, 'publish')).toBe(false);
        expect(canManageOrganization({ ...active, reviewStatus }, 'editProfile')).toBe(true);
    });
    it.each(['SUSPENDED', 'CLOSED'])('allows status reads but no writes when %s', operationalStatus => {
        expect(canManageOrganization({ ...active, operationalStatus }, 'read')).toBe(true);
        expect(canManageOrganization({ ...active, operationalStatus }, 'editProfile')).toBe(false);
    });
    it('fails closed for removed members, missing context, and unknown roles/actions', () => {
        expect(canManageOrganization({ ...active, membershipStatus: 'REMOVED' }, 'read')).toBe(false);
        expect(canManageOrganization(null, 'read')).toBe(false);
        expect(canManageOrganization({ ...active, role: 'REVIEWER' }, 'read')).toBe(false);
        expect(canManageOrganization(active, 'review')).toBe(false);
        expect(canManageOrganization({ ...active, operationalStatus: 'UNKNOWN' }, 'read')).toBe(false);
    });
});

describe('organization boundary validation', () => {
    it('normalizes optional fields without accepting ownership or publishing fields', () => {
        expect(createOrganizationSchema.parse(input)).toEqual({ ...input, name: '小橘中途', description: '', city: '', publicContact: '' });
    });
    it.each(['role', 'ownerId', 'userId', 'reviewStatus', 'publishedAt'])('rejects injected %s', field => {
        expect(createOrganizationSchema.safeParse({ ...input, [field]: 'injected' }).success).toBe(false);
    });
    it.each([{ name: '  ' }, { name: '貓'.repeat(101) }, { requestId: 'invalid' }, { type: 'ADMIN' }, { publicContact: 'x'.repeat(301) }])('rejects invalid fields: %j', patch => {
        expect(createOrganizationSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    });
    it('bounds pagination and refuses forged cursor/filter shapes', () => {
        expect(organizationListSchema.parse({})).toEqual({ pageSize: 20 });
        expect(organizationListSchema.parse({ pageSize: '2' })).toEqual({ pageSize: 2 });
        for (const query of [{ pageSize: 0 }, { pageSize: 51 }, { pageSize: ['2'] }, { cursor: 'bad' }, { userId: 'other' }]) {
            expect(organizationListSchema.safeParse(query).success).toBe(false);
        }
    });
});
