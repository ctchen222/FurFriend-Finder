import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
    OrganizationInvitationDetail,
    OrganizationInvitationSummary,
    OrganizationMembershipWorkspace,
    OrganizationOwnershipTransferDetail,
    OrganizationOwnershipTransferSummary,
} from '../../contracts/organizations';
import { withTransaction } from '../../libs/transaction';
import { OrganizationError } from './errors';
import {
    OrganizationMembershipRepository,
    type AccessRow,
    type AccountRow,
} from './membershipRepository';
import { canManageMember, canManageOrganization } from './policy';
import {
    createOrganizationToken,
    hashOrganizationToken,
    parseOrganizationToken,
} from './token';
import {
    createInvitationSchema,
    memberRoleSchema,
    organizationIdSchema,
    ownershipTransferSchema,
    tokenSchema,
    userIdSchema,
} from './validation';

const unavailable = () =>
    new OrganizationError(404, 'INVITATION_NOT_FOUND', '邀請連結無效或已失效');
const transferUnavailable = () =>
    new OrganizationError(404, 'TRANSFER_NOT_FOUND', '移轉連結無效或已失效');
const iso = (value: Date | string) => new Date(value).toISOString();

function requireAccount(
    account: AccountRow | undefined,
    verified = false,
): AccountRow {
    if (!account)
        throw new OrganizationError(
            401,
            'AUTHENTICATION_REQUIRED',
            '請重新登入',
        );
    if (verified && !account.emailVerified)
        throw new OrganizationError(
            403,
            'EMAIL_NOT_VERIFIED',
            '請先完成信箱驗證',
        );
    return account;
}

function requireAccess(
    access: AccessRow | undefined,
    write = false,
): AccessRow {
    if (!access || !canManageOrganization(access, 'read')) {
        throw new OrganizationError(
            404,
            'ORGANIZATION_NOT_FOUND',
            '找不到此組織',
        );
    }
    if (write && access.operationalStatus !== 'ACTIVE') {
        throw new OrganizationError(
            409,
            'ORGANIZATION_INACTIVE',
            '此中途之家目前無法變更成員',
        );
    }
    return access;
}

function invitationSummary(row: any): OrganizationInvitationSummary {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        expiresAt: iso(row.expiresAt ?? row.expires_at),
    };
}

function transferSummary(row: any): OrganizationOwnershipTransferSummary {
    return {
        id: row.id,
        toUserId: row.toUserId ?? row.to_user_id,
        toName: row.toName ?? row.to_name,
        status: row.status,
        expiresAt: iso(row.expiresAt ?? row.expires_at),
    };
}

export function createOrganizationMembershipService(db: Pool) {
    return {
        async list(
            actorId: string,
            rawOrganizationId: string,
        ): Promise<OrganizationMembershipWorkspace> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId));
                const access = requireAccess(
                    await repository.access(organizationId, actorId),
                );
                const canManageMembers =
                    access.role === 'OWNER' || access.role === 'ADMIN';
                const members = (await repository.members(organizationId)).map(
                    (member) => ({
                        userId: member.userId,
                        name: member.name,
                        ...(canManageMembers ? { email: member.email } : {}),
                        role: member.role,
                        joinedAt: iso(member.joinedAt),
                    }),
                );
                const invitations = canManageMembers
                    ? (await repository.invitations(organizationId)).map(
                          invitationSummary,
                      )
                    : [];
                const transfer =
                    access.role === 'OWNER'
                        ? await repository.pendingTransfer(organizationId)
                        : undefined;
                return {
                    members,
                    invitations,
                    transfer: transfer ? transferSummary(transfer) : null,
                    capabilities: {
                        inviteRoles:
                            access.role === 'OWNER'
                                ? ['ADMIN', 'EDITOR']
                                : access.role === 'ADMIN'
                                  ? ['EDITOR']
                                  : [],
                        canManageMembers,
                        canTransferOwnership: access.role === 'OWNER',
                    },
                };
            });
        },

        async invite(
            actorId: string,
            rawOrganizationId: string,
            raw: unknown,
        ): Promise<OrganizationInvitationSummary> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            const input = createInvitationSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                const actor = requireAccount(
                    await repository.account(actorId, true),
                    true,
                );
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                if (!canManageMember(access.role, null, input.role)) {
                    throw new OrganizationError(
                        403,
                        'MEMBER_MANAGEMENT_FORBIDDEN',
                        '你沒有權限邀請此角色',
                    );
                }
                if (
                    actor.email.toLowerCase() === input.email ||
                    (await repository.activeMemberByEmail(
                        organizationId,
                        input.email,
                    ))
                ) {
                    throw new OrganizationError(
                        409,
                        'ALREADY_MEMBER',
                        '此 Email 已是組織成員',
                    );
                }
                await repository.revokePendingInvitation(
                    organizationId,
                    input.email,
                );
                const id = randomUUID();
                const token = createOrganizationToken('invite', id);
                const invitation = await repository.insertInvitation({
                    id,
                    organizationId,
                    email: input.email,
                    role: input.role,
                    tokenHash: hashOrganizationToken(token),
                    invitedBy: actorId,
                });
                await repository.enqueueInvitation(organizationId, id);
                await repository.audit(
                    organizationId,
                    actorId,
                    'MEMBER_INVITED',
                    undefined,
                    id,
                );
                return invitationSummary(invitation);
            });
        },

        async revokeInvitation(
            actorId: string,
            rawOrganizationId: string,
            rawInvitationId: string,
        ): Promise<void> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            const invitationId = organizationIdSchema.parse(rawInvitationId);
            await withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                const invitation = await repository.invitationById(
                    organizationId,
                    invitationId,
                    true,
                );
                if (!invitation || invitation.status !== 'PENDING')
                    throw unavailable();
                if (!canManageMember(access.role, null, invitation.role)) {
                    throw new OrganizationError(
                        403,
                        'MEMBER_MANAGEMENT_FORBIDDEN',
                        '你沒有權限撤銷此邀請',
                    );
                }
                await repository.invitationStatus(invitation.id, 'REVOKED');
                await repository.audit(
                    organizationId,
                    actorId,
                    'MEMBER_INVITATION_REVOKED',
                    undefined,
                    invitation.id,
                );
            });
        },

        async invitationDetail(
            actorId: string,
            rawToken: string,
        ): Promise<OrganizationInvitationDetail> {
            const parsed = tokenSchema.safeParse(rawToken);
            if (!parsed.success) throw unavailable();
            const token = parsed.data;
            const id = parseOrganizationToken('invite', token);
            if (!id) throw unavailable();
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                const account = requireAccount(
                    await repository.account(actorId),
                );
                const invitation = await repository.invitationByToken(
                    id,
                    hashOrganizationToken(token),
                );
                if (!invitation) throw unavailable();
                const status =
                    invitation.status === 'PENDING' &&
                    new Date(invitation.expires_at) <= new Date()
                        ? 'EXPIRED'
                        : invitation.status;
                return {
                    organizationId: invitation.organization_id,
                    organizationName: invitation.organization_name,
                    role: invitation.role,
                    expiresAt: iso(invitation.expires_at),
                    accountMatches:
                        account.email.toLowerCase() === invitation.email,
                    status,
                };
            });
        },

        async respondInvitation(
            actorId: string,
            rawToken: string,
            action: 'ACCEPTED' | 'DECLINED',
        ) {
            const parsed = tokenSchema.safeParse(rawToken);
            if (!parsed.success) throw unavailable();
            const token = parsed.data;
            const id = parseOrganizationToken('invite', token);
            if (!id) throw unavailable();
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                const account = requireAccount(
                    await repository.account(actorId, true),
                    true,
                );
                const invitation = await repository.invitationByToken(
                    id,
                    hashOrganizationToken(token),
                    true,
                );
                if (!invitation) throw unavailable();
                if (
                    invitation.status === 'ACCEPTED' &&
                    invitation.accepted_by === actorId &&
                    action === 'ACCEPTED'
                ) {
                    return { organizationId: invitation.organization_id };
                }
                if (invitation.status !== 'PENDING') throw unavailable();
                if (new Date(invitation.expires_at) <= new Date()) {
                    await repository.invitationStatus(id, 'EXPIRED');
                    throw unavailable();
                }
                if (account.email.toLowerCase() !== invitation.email) {
                    throw new OrganizationError(
                        403,
                        'INVITATION_EMAIL_MISMATCH',
                        '請使用受邀的 Email 帳號登入',
                    );
                }
                if (invitation.operational_status !== 'ACTIVE') {
                    throw new OrganizationError(
                        409,
                        'ORGANIZATION_INACTIVE',
                        '此中途之家目前無法加入',
                    );
                }
                const inviter = requireAccess(
                    await repository.access(
                        invitation.organization_id,
                        invitation.invited_by,
                        true,
                    ),
                    true,
                );
                if (!canManageMember(inviter.role, null, invitation.role))
                    throw unavailable();
                if (action === 'DECLINED') {
                    await repository.invitationStatus(id, 'DECLINED');
                    await repository.audit(
                        invitation.organization_id,
                        actorId,
                        'MEMBER_INVITATION_DECLINED',
                        actorId,
                        id,
                    );
                    return { organizationId: invitation.organization_id };
                }
                const membership = await repository.membership(
                    invitation.organization_id,
                    actorId,
                    true,
                );
                if (membership?.status === 'ACTIVE') {
                    throw new OrganizationError(
                        409,
                        'ALREADY_MEMBER',
                        '你已是此組織成員，邀請不會變更原有權限',
                    );
                }
                await repository.activateMembership(
                    invitation.organization_id,
                    actorId,
                    invitation.role,
                );
                await repository.invitationStatus(id, 'ACCEPTED', actorId);
                await repository.audit(
                    invitation.organization_id,
                    actorId,
                    'MEMBER_INVITATION_ACCEPTED',
                    actorId,
                    id,
                );
                return { organizationId: invitation.organization_id };
            });
        },

        async updateMember(
            actorId: string,
            rawOrganizationId: string,
            targetUserId: string,
            raw: unknown,
        ) {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            targetUserId = userIdSchema.parse(targetUserId);
            const input = memberRoleSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                const target = await repository.membership(
                    organizationId,
                    targetUserId,
                    true,
                );
                if (!target || target.status !== 'ACTIVE')
                    throw new OrganizationError(
                        404,
                        'MEMBER_NOT_FOUND',
                        '找不到此成員',
                    );
                if (!canManageMember(access.role, target.role, input.role)) {
                    throw new OrganizationError(
                        403,
                        'MEMBER_MANAGEMENT_FORBIDDEN',
                        '你沒有權限變更此成員',
                    );
                }
                await repository.setMemberRole(
                    organizationId,
                    targetUserId,
                    input.role,
                );
                await repository.audit(
                    organizationId,
                    actorId,
                    'MEMBER_ROLE_CHANGED',
                    targetUserId,
                );
                return {
                    userId: targetUserId,
                    name: target.name,
                    email: target.email,
                    role: input.role,
                    joinedAt: iso(target.created_at),
                };
            });
        },

        async removeMember(
            actorId: string,
            rawOrganizationId: string,
            targetUserId: string,
        ): Promise<void> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            targetUserId = userIdSchema.parse(targetUserId);
            await withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                const target = await repository.membership(
                    organizationId,
                    targetUserId,
                    true,
                );
                if (!target || target.status !== 'ACTIVE')
                    throw new OrganizationError(
                        404,
                        'MEMBER_NOT_FOUND',
                        '找不到此成員',
                    );
                if (
                    actorId === targetUserId ||
                    !canManageMember(access.role, target.role, 'EDITOR')
                ) {
                    throw new OrganizationError(
                        403,
                        'MEMBER_MANAGEMENT_FORBIDDEN',
                        '你沒有權限移除此成員',
                    );
                }
                await repository.revokeTransfersToMember(
                    organizationId,
                    targetUserId,
                );
                await repository.removeMember(organizationId, targetUserId);
                await repository.audit(
                    organizationId,
                    actorId,
                    'MEMBER_REMOVED',
                    targetUserId,
                );
            });
        },

        async createTransfer(
            actorId: string,
            rawOrganizationId: string,
            raw: unknown,
        ): Promise<OrganizationOwnershipTransferSummary> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            const input = ownershipTransferSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                if (access.role !== 'OWNER')
                    throw new OrganizationError(
                        403,
                        'OWNERSHIP_TRANSFER_FORBIDDEN',
                        '只有負責人可以移轉組織',
                    );
                const target = await repository.membership(
                    organizationId,
                    input.toUserId,
                    true,
                );
                if (
                    !target ||
                    target.status !== 'ACTIVE' ||
                    target.role === 'OWNER'
                ) {
                    throw new OrganizationError(
                        422,
                        'TRANSFER_TARGET_INVALID',
                        '請選擇目前的管理員或協作者',
                    );
                }
                await repository.revokePendingTransfer(organizationId);
                const id = randomUUID();
                const token = createOrganizationToken('transfer', id);
                const transfer = await repository.insertTransfer({
                    id,
                    organizationId,
                    fromUserId: actorId,
                    toUserId: input.toUserId,
                    tokenHash: hashOrganizationToken(token),
                });
                await repository.enqueueTransfer(organizationId, id);
                await repository.audit(
                    organizationId,
                    actorId,
                    'OWNERSHIP_TRANSFER_REQUESTED',
                    input.toUserId,
                    id,
                );
                return transferSummary({ ...transfer, toName: target.name });
            });
        },

        async revokeTransfer(
            actorId: string,
            rawOrganizationId: string,
            rawTransferId: string,
        ): Promise<void> {
            const organizationId =
                organizationIdSchema.parse(rawOrganizationId);
            const transferId = organizationIdSchema.parse(rawTransferId);
            await withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const access = requireAccess(
                    await repository.access(organizationId, actorId, true),
                    true,
                );
                if (access.role !== 'OWNER')
                    throw new OrganizationError(
                        403,
                        'OWNERSHIP_TRANSFER_FORBIDDEN',
                        '只有負責人可以撤銷移轉',
                    );
                const transfer = await repository.transferById(
                    organizationId,
                    transferId,
                    true,
                );
                if (!transfer || transfer.status !== 'PENDING')
                    throw transferUnavailable();
                await repository.transferStatus(transferId, 'REVOKED');
                await repository.audit(
                    organizationId,
                    actorId,
                    'OWNERSHIP_TRANSFER_REVOKED',
                    transfer.to_user_id,
                    transferId,
                );
            });
        },

        async transferDetail(
            actorId: string,
            rawToken: string,
        ): Promise<OrganizationOwnershipTransferDetail> {
            const parsed = tokenSchema.safeParse(rawToken);
            if (!parsed.success) throw transferUnavailable();
            const token = parsed.data;
            const id = parseOrganizationToken('transfer', token);
            if (!id) throw transferUnavailable();
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId));
                const transfer = await repository.transferByToken(
                    id,
                    hashOrganizationToken(token),
                );
                if (!transfer) throw transferUnavailable();
                return {
                    organizationId: transfer.organization_id,
                    organizationName: transfer.organization_name,
                    fromName: transfer.from_name,
                    toName: transfer.to_name,
                    expiresAt: iso(transfer.expires_at),
                    accountMatches: actorId === transfer.to_user_id,
                    status:
                        transfer.status === 'PENDING' &&
                        new Date(transfer.expires_at) <= new Date()
                            ? 'EXPIRED'
                            : transfer.status,
                };
            });
        },

        async respondTransfer(
            actorId: string,
            rawToken: string,
            action: 'ACCEPTED' | 'DECLINED',
        ) {
            const parsed = tokenSchema.safeParse(rawToken);
            if (!parsed.success) throw transferUnavailable();
            const token = parsed.data;
            const id = parseOrganizationToken('transfer', token);
            if (!id) throw transferUnavailable();
            return withTransaction(db, async (client) => {
                const repository = new OrganizationMembershipRepository(client);
                requireAccount(await repository.account(actorId, true), true);
                const transfer = await repository.transferByToken(
                    id,
                    hashOrganizationToken(token),
                    true,
                );
                if (!transfer) throw transferUnavailable();
                if (
                    transfer.status === 'ACCEPTED' &&
                    transfer.to_user_id === actorId &&
                    action === 'ACCEPTED'
                ) {
                    return { organizationId: transfer.organization_id };
                }
                if (transfer.status !== 'PENDING') throw transferUnavailable();
                if (new Date(transfer.expires_at) <= new Date()) {
                    await repository.transferStatus(id, 'EXPIRED');
                    throw transferUnavailable();
                }
                if (transfer.to_user_id !== actorId) {
                    throw new OrganizationError(
                        403,
                        'TRANSFER_ACCOUNT_MISMATCH',
                        '請使用受邀接任的帳號登入',
                    );
                }
                if (transfer.operational_status !== 'ACTIVE') {
                    throw new OrganizationError(
                        409,
                        'ORGANIZATION_INACTIVE',
                        '此中途之家目前無法移轉',
                    );
                }
                const owner = requireAccess(
                    await repository.access(
                        transfer.organization_id,
                        transfer.from_user_id,
                        true,
                    ),
                    true,
                );
                if (owner.role !== 'OWNER') throw transferUnavailable();
                const target = await repository.membership(
                    transfer.organization_id,
                    actorId,
                    true,
                );
                if (
                    !target ||
                    target.status !== 'ACTIVE' ||
                    target.role === 'OWNER'
                )
                    throw transferUnavailable();
                if (action === 'DECLINED') {
                    await repository.transferStatus(id, 'DECLINED');
                    await repository.audit(
                        transfer.organization_id,
                        actorId,
                        'OWNERSHIP_TRANSFER_DECLINED',
                        actorId,
                        id,
                    );
                    return { organizationId: transfer.organization_id };
                }
                await repository.lockTransferMembers(
                    transfer.organization_id,
                    [transfer.from_user_id, actorId].sort(),
                );
                await repository.acceptTransfer(
                    transfer.organization_id,
                    transfer.from_user_id,
                    actorId,
                );
                await repository.transferStatus(id, 'ACCEPTED');
                await repository.audit(
                    transfer.organization_id,
                    actorId,
                    'OWNERSHIP_TRANSFER_ACCEPTED',
                    actorId,
                    id,
                );
                return { organizationId: transfer.organization_id };
            });
        },
    };
}

export type OrganizationMembershipService = ReturnType<
    typeof createOrganizationMembershipService
>;
