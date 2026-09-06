export interface OrganizationAccessContext {
    role: string;
    membershipStatus: string;
    operationalStatus: string;
    reviewStatus: string;
}

/** Fail closed; platform review is deliberately not an organization capability. */
export function canManageOrganization(context: OrganizationAccessContext | null, action: string): boolean {
    if (!context || context.membershipStatus !== 'ACTIVE') return false;
    if (!['OWNER', 'ADMIN', 'EDITOR'].includes(context.role)) return false;
    if (!['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(context.operationalStatus)) return false;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(context.reviewStatus)) return false;
    if (action === 'read') return true;
    if (context.operationalStatus !== 'ACTIVE') return false;
    if (action === 'editProfile') return context.role === 'OWNER' || context.role === 'ADMIN';
    if (action === 'publish') return context.reviewStatus === 'APPROVED' && (context.role === 'OWNER' || context.role === 'ADMIN');
    return false;
}
