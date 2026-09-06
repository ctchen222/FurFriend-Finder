/** JSON-only contracts: safe to import from the React client. */
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'EDITOR';
export type OrganizationType = 'INDIVIDUAL' | 'GROUP';
export type OrganizationReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrganizationOperationalStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface CreateOrganizationInput {
    /** Generate once per creation intent; reuse unchanged when retrying. */
    requestId: string;
    name: string;
    type: OrganizationType;
    description?: string;
    city?: string;
    publicContact?: string;
}

/** Private workspace projection, never use this shape for a public directory. */
export interface OrganizationWorkspace {
    id: string;
    name: string;
    type: OrganizationType;
    description: string;
    city: string;
    publicContact: string;
    reviewStatus: OrganizationReviewStatus;
    operationalStatus: OrganizationOperationalStatus;
    publishedAt: string | null;
    version: number;
    role: OrganizationRole;
}

export interface OrganizationPage {
    organizations: OrganizationWorkspace[];
    nextCursor: string | null;
}

export type OrganizationMembershipStatus = 'ACTIVE' | 'REMOVED';
export type OrganizationInvitationStatus =
    | 'PENDING'
    | 'ACCEPTED'
    | 'DECLINED'
    | 'REVOKED'
    | 'EXPIRED';

export interface OrganizationMember {
    userId: string;
    name: string;
    email?: string;
    role: OrganizationRole;
    joinedAt: string;
}

export interface OrganizationInvitationSummary {
    id: string;
    email: string;
    role: Exclude<OrganizationRole, 'OWNER'>;
    status: OrganizationInvitationStatus;
    expiresAt: string;
}

export interface OrganizationOwnershipTransferSummary {
    id: string;
    toUserId: string;
    toName: string;
    status: OrganizationInvitationStatus;
    expiresAt: string;
}

export interface OrganizationMemberCapabilities {
    inviteRoles: Array<Exclude<OrganizationRole, 'OWNER'>>;
    canManageMembers: boolean;
    canTransferOwnership: boolean;
}

export interface OrganizationMembershipWorkspace {
    members: OrganizationMember[];
    invitations: OrganizationInvitationSummary[];
    transfer: OrganizationOwnershipTransferSummary | null;
    capabilities: OrganizationMemberCapabilities;
}

export interface OrganizationInvitationDetail {
    organizationId: string;
    organizationName: string;
    role: Exclude<OrganizationRole, 'OWNER'>;
    expiresAt: string;
    accountMatches: boolean;
    status: OrganizationInvitationStatus;
}

export interface OrganizationOwnershipTransferDetail {
    organizationId: string;
    organizationName: string;
    fromName: string;
    toName: string;
    expiresAt: string;
    accountMatches: boolean;
    status: OrganizationInvitationStatus;
}
