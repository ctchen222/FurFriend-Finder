import type { DbExecutor } from '../../libs/transaction';

export interface AccessRow {
    organizationId: string;
    organizationName: string;
    operationalStatus: string;
    reviewStatus: string;
    ownerUserId: string;
    role: string;
    membershipStatus: string;
}
export interface AccountRow {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
}

export class OrganizationMembershipRepository {
    constructor(private readonly db: DbExecutor) {}

    async account(
        userId: string,
        lock = false,
    ): Promise<AccountRow | undefined> {
        const result = await this.db.query<AccountRow>(
            `SELECT id,name,email,"emailVerified" FROM "user" WHERE id=$1 ${lock ? 'FOR SHARE' : ''}`,
            [userId],
        );
        return result.rows[0];
    }

    async access(
        organizationId: string,
        actorId: string,
        lock = false,
    ): Promise<AccessRow | undefined> {
        const result = await this.db.query<AccessRow>(
            `SELECT o.id AS "organizationId",o.name AS "organizationName",
                    o.operational_status AS "operationalStatus",o.review_status AS "reviewStatus",
                    o.owner_user_id AS "ownerUserId",m.role,m.status AS "membershipStatus"
             FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
             WHERE o.id=$1 AND m.user_id=$2 ${lock ? 'FOR UPDATE OF o,m' : ''}`,
            [organizationId, actorId],
        );
        return result.rows[0];
    }

    async members(organizationId: string) {
        return (
            await this.db.query<any>(
                `SELECT m.user_id AS "userId",u.name,u.email,m.role,m.created_at AS "joinedAt"
             FROM organization_memberships m JOIN "user" u ON u.id=m.user_id
             WHERE m.organization_id=$1 AND m.status='ACTIVE'
             ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,u.name,u.id`,
                [organizationId],
            )
        ).rows;
    }

    async invitations(organizationId: string) {
        return (
            await this.db.query<any>(
                `SELECT i.id,i.email,i.role,i.status,i.expires_at AS "expiresAt",
                        m.state AS "deliveryState",m.attempts,m.sent_at AS "sentAt",
                        m.last_error_code AS "failureReason",
                        m.created_at + INTERVAL '60 seconds' AS "resendAvailableAt"
                 FROM organization_invitations i
                 JOIN organization_mail_outbox m ON m.invitation_id=i.id
                 WHERE i.organization_id=$1 AND i.status='PENDING' AND i.expires_at>CURRENT_TIMESTAMP
                 ORDER BY i.created_at DESC,i.id`,
                [organizationId],
            )
        ).rows;
    }

    async mailCooldownAvailable(
        organizationId: string,
        kind: 'MEMBER_INVITATION' | 'OWNERSHIP_TRANSFER',
        recipient: string,
    ): Promise<boolean> {
        const query =
            kind === 'MEMBER_INVITATION'
                ? `SELECT m.created_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds' AS available
                   FROM organization_mail_outbox m
                   JOIN organization_invitations i ON i.id=m.invitation_id
                   WHERE m.organization_id=$1 AND m.kind=$2 AND i.email=$3
                   ORDER BY m.created_at DESC,m.id DESC LIMIT 1 FOR UPDATE OF m`
                : `SELECT m.created_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds' AS available
                   FROM organization_mail_outbox m
                   JOIN organization_ownership_transfers t ON t.id=m.transfer_id
                   WHERE m.organization_id=$1 AND m.kind=$2 AND t.to_user_id=$3
                   ORDER BY m.created_at DESC,m.id DESC LIMIT 1 FOR UPDATE OF m`;
        const result = await this.db.query<{ available: boolean }>(query, [
            organizationId,
            kind,
            recipient,
        ]);
        return result.rows[0]?.available ?? true;
    }

    async pendingTransfer(organizationId: string) {
        return (
            await this.db.query<any>(
                `SELECT t.id,t.to_user_id AS "toUserId",u.name AS "toName",t.status,t.expires_at AS "expiresAt"
             FROM organization_ownership_transfers t JOIN "user" u ON u.id=t.to_user_id
             WHERE t.organization_id=$1 AND t.status='PENDING' AND t.expires_at>CURRENT_TIMESTAMP`,
                [organizationId],
            )
        ).rows[0];
    }

    async activeMemberByEmail(organizationId: string, email: string) {
        return (
            await this.db.query<any>(
                `SELECT m.user_id AS "userId",m.role FROM organization_memberships m JOIN "user" u ON u.id=m.user_id
             WHERE m.organization_id=$1 AND m.status='ACTIVE' AND lower(u.email)=$2`,
                [organizationId, email],
            )
        ).rows[0];
    }

    async revokePendingInvitation(organizationId: string, email: string) {
        await this.db.query(
            `UPDATE organization_invitations SET status='REVOKED',updated_at=CURRENT_TIMESTAMP
             WHERE organization_id=$1 AND email=$2 AND status='PENDING'`,
            [organizationId, email],
        );
    }

    async insertInvitation(input: {
        id: string;
        organizationId: string;
        email: string;
        role: string;
        tokenHash: string;
        invitedBy: string;
    }) {
        return (
            await this.db.query<any>(
                `INSERT INTO organization_invitations (id,organization_id,email,role,token_hash,invited_by,expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP + INTERVAL '7 days')
             RETURNING id,email,role,status,expires_at AS "expiresAt"`,
                [
                    input.id,
                    input.organizationId,
                    input.email,
                    input.role,
                    input.tokenHash,
                    input.invitedBy,
                ],
            )
        ).rows[0];
    }

    async enqueueInvitation(organizationId: string, invitationId: string) {
        await this.db.query(
            `INSERT INTO organization_mail_outbox (organization_id,invitation_id,kind,dedupe_key)
             VALUES ($1,$2,'MEMBER_INVITATION',$3)`,
            [organizationId, invitationId, `MEMBER_INVITATION:${invitationId}`],
        );
    }

    async invitationById(
        organizationId: string,
        invitationId: string,
        lock = false,
    ) {
        return (
            await this.db.query<any>(
                `SELECT i.*,o.name AS organization_name FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
             WHERE i.organization_id=$1 AND i.id=$2 ${lock ? 'FOR UPDATE OF i' : ''}`,
                [organizationId, invitationId],
            )
        ).rows[0];
    }

    async invitationByToken(id: string, tokenHash: string, lock = false) {
        return (
            await this.db.query<any>(
                `SELECT i.*,o.name AS organization_name,o.operational_status
             FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
             WHERE i.id=$1 AND i.token_hash=$2 ${lock ? 'FOR UPDATE OF i,o' : ''}`,
                [id, tokenHash],
            )
        ).rows[0];
    }

    async invitationStatus(id: string, status: string, acceptedBy?: string) {
        await this.db.query(
            `UPDATE organization_invitations SET status=$2,accepted_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, status, acceptedBy ?? null],
        );
    }

    async membership(organizationId: string, userId: string, lock = false) {
        return (
            await this.db.query<any>(
                `SELECT m.*,u.name,u.email FROM organization_memberships m JOIN "user" u ON u.id=m.user_id
             WHERE m.organization_id=$1 AND m.user_id=$2 ${lock ? 'FOR UPDATE OF m' : ''}`,
                [organizationId, userId],
            )
        ).rows[0];
    }

    async activateMembership(
        organizationId: string,
        userId: string,
        role: string,
    ) {
        await this.db.query(
            `INSERT INTO organization_memberships (organization_id,user_id,role,status) VALUES ($1,$2,$3,'ACTIVE')
             ON CONFLICT (organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',updated_at=CURRENT_TIMESTAMP`,
            [organizationId, userId, role],
        );
    }

    async setMemberRole(organizationId: string, userId: string, role: string) {
        await this.db.query(
            `UPDATE organization_memberships SET role=$3,updated_at=CURRENT_TIMESTAMP
             WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
            [organizationId, userId, role],
        );
    }

    async removeMember(organizationId: string, userId: string) {
        await this.db.query(
            `UPDATE organization_memberships SET status='REMOVED',updated_at=CURRENT_TIMESTAMP
             WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
            [organizationId, userId],
        );
    }

    async revokeTransfersToMember(organizationId: string, userId: string) {
        await this.db.query(
            `UPDATE organization_ownership_transfers SET status='REVOKED',updated_at=CURRENT_TIMESTAMP
             WHERE organization_id=$1 AND to_user_id=$2 AND status='PENDING'`,
            [organizationId, userId],
        );
    }

    async revokePendingTransfer(organizationId: string) {
        await this.db.query(
            `UPDATE organization_ownership_transfers SET status='REVOKED',updated_at=CURRENT_TIMESTAMP
             WHERE organization_id=$1 AND status='PENDING'`,
            [organizationId],
        );
    }

    async insertTransfer(input: {
        id: string;
        organizationId: string;
        fromUserId: string;
        toUserId: string;
        tokenHash: string;
    }) {
        return (
            await this.db.query<any>(
                `INSERT INTO organization_ownership_transfers
             (id,organization_id,from_user_id,to_user_id,token_hash,expires_at)
             VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP + INTERVAL '24 hours')
             RETURNING id,to_user_id AS "toUserId",status,expires_at AS "expiresAt"`,
                [
                    input.id,
                    input.organizationId,
                    input.fromUserId,
                    input.toUserId,
                    input.tokenHash,
                ],
            )
        ).rows[0];
    }

    async enqueueTransfer(organizationId: string, transferId: string) {
        await this.db.query(
            `INSERT INTO organization_mail_outbox (organization_id,transfer_id,kind,dedupe_key)
             VALUES ($1,$2,'OWNERSHIP_TRANSFER',$3)`,
            [organizationId, transferId, `OWNERSHIP_TRANSFER:${transferId}`],
        );
    }

    async transferById(
        organizationId: string,
        transferId: string,
        lock = false,
    ) {
        return (
            await this.db.query<any>(
                `SELECT t.*,u.name AS to_name FROM organization_ownership_transfers t JOIN "user" u ON u.id=t.to_user_id
             WHERE t.organization_id=$1 AND t.id=$2 ${lock ? 'FOR UPDATE OF t' : ''}`,
                [organizationId, transferId],
            )
        ).rows[0];
    }

    async transferByToken(id: string, tokenHash: string, lock = false) {
        return (
            await this.db.query<any>(
                `SELECT t.*,o.name AS organization_name,o.operational_status,old.name AS from_name,next.name AS to_name
             FROM organization_ownership_transfers t JOIN organizations o ON o.id=t.organization_id
             JOIN "user" old ON old.id=t.from_user_id JOIN "user" next ON next.id=t.to_user_id
             WHERE t.id=$1 AND t.token_hash=$2 ${lock ? 'FOR UPDATE OF t,o' : ''}`,
                [id, tokenHash],
            )
        ).rows[0];
    }

    async transferStatus(id: string, status: string) {
        await this.db.query(
            `UPDATE organization_ownership_transfers SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, status],
        );
    }

    async lockTransferMembers(organizationId: string, userIds: string[]) {
        await this.db.query(
            `SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND user_id=ANY($2::text[])
             ORDER BY user_id FOR UPDATE`,
            [organizationId, userIds],
        );
    }

    async acceptTransfer(
        organizationId: string,
        fromUserId: string,
        toUserId: string,
    ) {
        await this.setMemberRole(organizationId, fromUserId, 'ADMIN');
        await this.setMemberRole(organizationId, toUserId, 'OWNER');
        await this.db.query(
            `UPDATE organizations SET owner_user_id=$2,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [organizationId, toUserId],
        );
    }

    async audit(
        organizationId: string,
        actorId: string,
        action: string,
        targetUserId?: string,
        subjectId?: string,
    ) {
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action,target_user_id,subject_id)
             VALUES ($1,$2,$3,$4,$5)`,
            [
                organizationId,
                actorId,
                action,
                targetUserId ?? null,
                subjectId ?? null,
            ],
        );
    }
}
