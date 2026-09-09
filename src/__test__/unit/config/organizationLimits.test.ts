import { getOrganizationLimits } from '../../../config/organizationLimits';

describe('organization resource limits', () => {
    it('uses bounded defaults', () => {
        expect(getOrganizationLimits({})).toEqual({
            maxOrganizationsPerUser: 5,
            maxAnimalsPerOrganization: 500,
            maxPhotoBytesPerOrganization: 1073741824,
            photoProcessingConcurrency: 2,
        });
    });

    const settings = [
        ['MAX_ORGANIZATIONS_PER_USER', 'maxOrganizationsPerUser', 100],
        ['MAX_ANIMALS_PER_ORGANIZATION', 'maxAnimalsPerOrganization', 100000],
        [
            'MAX_ORGANIZATION_PHOTO_BYTES',
            'maxPhotoBytesPerOrganization',
            1099511627776,
        ],
        ['PHOTO_PROCESSING_CONCURRENCY', 'photoProcessingConcurrency', 32],
    ] as const;

    it.each(settings)(
        'accepts positive integers through the maximum for %s',
        (key, field, maximum) => {
            expect(getOrganizationLimits({ [key]: '1' })[field]).toBe(1);
            expect(
                getOrganizationLimits({ [key]: String(maximum) })[field],
            ).toBe(maximum);
            expect(() =>
                getOrganizationLimits({ [key]: String(maximum + 1) }),
            ).toThrow(key);
        },
    );

    it.each(settings)('rejects malformed or unsafe values for %s', (key) => {
        for (const value of [
            '',
            '0',
            '-1',
            '1.5',
            ' 2',
            '2 ',
            '2\n',
            '2ms',
            '1e2',
            '+2',
            '02',
            '9007199254740992',
        ]) {
            expect(() => getOrganizationLimits({ [key]: value })).toThrow(key);
        }
    });
});
