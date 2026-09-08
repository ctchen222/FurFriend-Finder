export interface OrganizationAccessContext {
    role: string;
    membershipStatus: string;
    operationalStatus: string;
    reviewStatus: string;
}

/** Fail closed; platform review is deliberately not an organization capability. */
export function canManageOrganization(
    context: OrganizationAccessContext | null,
    action: string,
): boolean {
    if (!context || context.membershipStatus !== 'ACTIVE') return false;
    if (!['OWNER', 'ADMIN', 'EDITOR'].includes(context.role)) return false;
    if (!['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(context.operationalStatus))
        return false;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(context.reviewStatus))
        return false;
    if (action === 'read') return true;
    if (context.operationalStatus !== 'ACTIVE') return false;
    if (action === 'editProfile')
        return context.role === 'OWNER' || context.role === 'ADMIN';
    if (action === 'publish')
        return (
            context.reviewStatus === 'APPROVED' &&
            (context.role === 'OWNER' || context.role === 'ADMIN')
        );
    return false;
}

/** `targetRole=null` represents a new invitation. Owner changes require the transfer flow. */
export function canManageMember(
    actorRole: string,
    targetRole: string | null,
    desiredRole: string,
): boolean {
    if (!['ADMIN', 'EDITOR'].includes(desiredRole) || targetRole === 'OWNER')
        return false;
    if (actorRole === 'OWNER')
        return (
            targetRole === null ||
            targetRole === 'ADMIN' ||
            targetRole === 'EDITOR'
        );
    return (
        actorRole === 'ADMIN' &&
        (targetRole === null || targetRole === 'EDITOR') &&
        desiredRole === 'EDITOR'
    );
}

export function canReviewOrganization(
    isReviewer: boolean,
    isActiveMember: boolean,
): boolean {
    return isReviewer && !isActiveMember;
}
