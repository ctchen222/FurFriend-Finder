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
