export interface OrganizationLimits {
    maxOrganizationsPerUser: number;
    maxAnimalsPerOrganization: number;
    maxPhotoBytesPerOrganization: number;
    photoProcessingConcurrency: number;
}

export function getOrganizationLimits(
    env: NodeJS.ProcessEnv = process.env,
): OrganizationLimits {
    function positiveInteger(key: string, fallback: number, maximum: number) {
        const raw = env[key];
        if (raw === undefined) return fallback;
        const value = Number(raw);
        if (
            !/^[1-9][0-9]*$/.test(raw) ||
            !Number.isSafeInteger(value) ||
            value > maximum
        ) {
            throw new Error(
                `${key} must be an integer between 1 and ${maximum}`,
            );
        }
        return value;
    }
    return {
        maxOrganizationsPerUser: positiveInteger(
            'MAX_ORGANIZATIONS_PER_USER',
            5,
            100,
        ),
        maxAnimalsPerOrganization: positiveInteger(
            'MAX_ANIMALS_PER_ORGANIZATION',
            500,
            100000,
        ),
        maxPhotoBytesPerOrganization: positiveInteger(
            'MAX_ORGANIZATION_PHOTO_BYTES',
            1073741824,
            1099511627776,
        ),
        photoProcessingConcurrency: positiveInteger(
            'PHOTO_PROCESSING_CONCURRENCY',
            2,
            32,
        ),
    };
}
