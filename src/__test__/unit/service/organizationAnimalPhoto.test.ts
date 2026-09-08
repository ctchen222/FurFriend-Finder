import sharp from 'sharp';
import type { Pool } from 'pg';
import { createOrganizationAnimalService } from '../../../Service/organizations/animalService';
import { OrganizationAnimalRepository } from '../../../Service/organizations/animalRepository';
import { OrganizationProfileRepository } from '../../../Service/organizations/profileRepository';
import { OrganizationMembershipRepository } from '../../../Service/organizations/membershipRepository';
import { getOrganizationLimits } from '../../../config/organizationLimits';
import * as photoNormalization from '../../../Service/organizations/animalPhoto';
import { normalizeAnimalPhoto } from '../../../Service/organizations/animalPhoto';
import { PhotoWorkLimiter } from '../../../Service/organizations/photoWorkLimiter';
import {
    createListingSchema,
    updateListingSchema,
} from '../../../Service/organizations/animalValidation';

describe('photo processing permits', () => {
    it('fails fast at capacity and releases each permit only once', () => {
        const limiter = new PhotoWorkLimiter();
        const first = limiter.tryAcquire()!;
        const second = limiter.tryAcquire()!;
        expect(first).toBeInstanceOf(Function);
        expect(second).toBeInstanceOf(Function);
        expect(limiter.tryAcquire()).toBeNull();
        first();
        first();
        const replacement = limiter.tryAcquire()!;
        expect(replacement).toBeInstanceOf(Function);
        expect(limiter.tryAcquire()).toBeNull();
        second();
        replacement();
    });
    it.each([0, -1, 1.5, NaN, Infinity, 33])(
        'rejects invalid capacity %s',
        (capacity) => {
            expect(() => new PhotoWorkLimiter(capacity)).toThrow();
        },
    );
});

describe('photo service resource boundaries', () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const animalId = '22222222-2222-4222-8222-222222222222';
    const animal = {
        id: animalId,
        organizationId: orgId,
        version: 1,
        publishedAt: null,
        photoIds: [],
    };
    let transactionOpen: boolean;
    let limiter: PhotoWorkLimiter;
    let service: ReturnType<typeof createOrganizationAnimalService>;

    beforeEach(() => {
        transactionOpen = false;
        limiter = new PhotoWorkLimiter(1);
        const client = {
            query: jest.fn(async (sql: string) => {
                if (sql === 'BEGIN') transactionOpen = true;
                if (sql === 'COMMIT' || sql === 'ROLLBACK')
                    transactionOpen = false;
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        const db = { connect: async () => client } as unknown as Pool;
        jest.spyOn(
            OrganizationProfileRepository.prototype,
            'workspace',
        ).mockResolvedValue({
            role: 'OWNER',
            membershipStatus: 'ACTIVE',
            operationalStatus: 'ACTIVE',
            reviewStatus: 'PENDING',
        });
        jest.spyOn(
            OrganizationMembershipRepository.prototype,
            'account',
        ).mockResolvedValue({
            id: 'owner',
            emailVerified: true,
            email: 'owner@example.test',
            name: 'owner',
        });
        jest.spyOn(
            OrganizationMembershipRepository.prototype,
            'audit',
        ).mockResolvedValue(undefined);
        jest.spyOn(
            OrganizationAnimalRepository.prototype,
            'detail',
        ).mockResolvedValue(animal as any);
        jest.spyOn(
            OrganizationAnimalRepository.prototype,
            'photoBytes',
        ).mockResolvedValue(BigInt(0));
        jest.spyOn(
            OrganizationAnimalRepository.prototype,
            'addPhoto',
        ).mockResolvedValue(undefined);
        jest.spyOn(
            OrganizationAnimalRepository.prototype,
            'touch',
        ).mockResolvedValue(undefined);
        jest.spyOn(
            photoNormalization,
            'normalizeAnimalPhoto',
        ).mockImplementation(async () => {
            expect(transactionOpen).toBe(false);
            return Buffer.from('normalized');
        });
        service = createOrganizationAnimalService(db, {
            limits: getOrganizationLimits({}),
            photoWorkLimiter: limiter,
        });
    });

    const upload = () =>
        service.addPhoto(
            'owner',
            orgId,
            animalId,
            { expectedVersion: 1 },
            Buffer.from('input'),
        );
    function expectPermitAvailable() {
        const release = limiter.tryAcquire();
        expect(release).not.toBeNull();
        expect(limiter.tryAcquire()).toBeNull();
        release!();
    }

    it('normalizes outside transactions and returns its permit after success', async () => {
        await upload();
        expect(photoNormalization.normalizeAnimalPhoto).toHaveBeenCalledTimes(
            1,
        );
        expectPermitAvailable();
    });

    it('rejects unauthorized requests before acquiring a permit or decoding', async () => {
        jest.mocked(
            OrganizationProfileRepository.prototype.workspace,
        ).mockResolvedValue(undefined);
        const acquire = jest.spyOn(limiter, 'tryAcquire');
        await expect(upload()).rejects.toMatchObject({ status: 404 });
        expect(acquire).not.toHaveBeenCalled();
        expect(photoNormalization.normalizeAnimalPhoto).not.toHaveBeenCalled();
    });

    it('rejects a missing or published animal before decoding', async () => {
        jest.mocked(
            OrganizationAnimalRepository.prototype.detail,
        ).mockResolvedValueOnce(undefined);
        await expect(upload()).rejects.toMatchObject({ status: 404 });
        jest.mocked(
            OrganizationAnimalRepository.prototype.detail,
        ).mockResolvedValueOnce({ ...animal, publishedAt: 'now' } as any);
        await expect(upload()).rejects.toMatchObject({
            code: 'ANIMAL_IS_PUBLISHED',
        });
        expect(photoNormalization.normalizeAnimalPhoto).not.toHaveBeenCalled();
        expectPermitAvailable();
    });

    it('fails fast while an authorized upload is normalizing, then recovers', async () => {
        let finish!: (value: Buffer) => void;
        let started!: () => void;
        const ready = new Promise<void>((resolve) => {
            started = resolve;
        });
        jest.mocked(
            photoNormalization.normalizeAnimalPhoto,
        ).mockImplementationOnce(() => {
            expect(transactionOpen).toBe(false);
            started();
            return new Promise<Buffer>((resolve) => {
                finish = resolve;
            });
        });
        const pending = upload();
        await ready;
        await expect(upload()).rejects.toMatchObject({
            status: 429,
            code: 'PHOTO_PROCESSING_BUSY',
        });
        expect(photoNormalization.normalizeAnimalPhoto).toHaveBeenCalledTimes(
            1,
        );
        finish(Buffer.from('normalized'));
        await pending;
        expectPermitAvailable();
    });

    it.each([
        'normalization',
        'permission',
        'version',
        'photo count',
        'byte quota',
        'write',
        'audit',
    ])(
        'releases the permit and closes transactions after %s failure',
        async (failure) => {
            if (failure === 'normalization')
                jest.mocked(
                    photoNormalization.normalizeAnimalPhoto,
                ).mockRejectedValueOnce(new Error('decode failure'));
            if (failure === 'permission')
                jest.mocked(OrganizationProfileRepository.prototype.workspace)
                    .mockResolvedValueOnce({
                        role: 'OWNER',
                        membershipStatus: 'ACTIVE',
                        operationalStatus: 'ACTIVE',
                        reviewStatus: 'PENDING',
                    })
                    .mockResolvedValueOnce(undefined);
            if (failure === 'version' || failure === 'photo count')
                jest.mocked(OrganizationAnimalRepository.prototype.detail)
                    .mockResolvedValueOnce(animal as any)
                    .mockResolvedValueOnce({
                        ...animal,
                        ...(failure === 'version'
                            ? { version: 2 }
                            : { photoIds: Array(6).fill('photo') }),
                    } as any);
            if (failure === 'byte quota')
                jest.mocked(
                    OrganizationAnimalRepository.prototype.photoBytes,
                ).mockResolvedValueOnce(BigInt(1073741824));
            if (failure === 'write')
                jest.mocked(
                    OrganizationAnimalRepository.prototype.addPhoto,
                ).mockRejectedValueOnce(new Error('insert failure'));
            if (failure === 'audit')
                jest.mocked(
                    OrganizationMembershipRepository.prototype.audit,
                ).mockRejectedValueOnce(new Error('audit failure'));
            const expectedFailure: Record<string, object> = {
                normalization: { message: 'decode failure' },
                permission: { code: 'ANIMAL_LISTING_NOT_FOUND' },
                version: { code: 'ANIMAL_VERSION_CONFLICT' },
                'photo count': { code: 'PHOTO_LIMIT' },
                'byte quota': { code: 'ORGANIZATION_PHOTO_QUOTA' },
                write: { message: 'insert failure' },
                audit: { message: 'audit failure' },
            };
            await expect(upload()).rejects.toMatchObject(expectedFailure[failure]);
            expect(
                photoNormalization.normalizeAnimalPhoto,
            ).toHaveBeenCalledTimes(1);
            expect(transactionOpen).toBe(false);
            expectPermitAvailable();
        },
    );
});

describe('organization listing input', () => {
    it('accepts a minimal draft without forcing guessed traits', () => {
        const draft = createListingSchema.parse({
            requestId: '11111111-1111-4111-8111-111111111111',
            name: ' 小橘 ',
            species: 'CAT',
        });
        expect(draft).toMatchObject({
            name: '小橘',
            sex: 'UNKNOWN',
            description: '',
            adoptionStatus: 'AVAILABLE',
        });
    });
    it('rejects publication injection, invalid statuses and stale version shapes', () => {
        expect(
            updateListingSchema.safeParse({
                name: '小橘',
                species: 'CAT',
                expectedVersion: 1,
                publishedAt: 'now',
            }).success,
        ).toBe(false);
        expect(
            updateListingSchema.safeParse({
                name: '小橘',
                species: 'CAT',
                expectedVersion: 0,
            }).success,
        ).toBe(false);
        expect(
            createListingSchema.safeParse({
                requestId: 'invalid',
                name: '',
                species: 'CAT',
            }).success,
        ).toBe(false);
    });
});
describe('organization photo normalization', () => {
    it('resizes, decodes, re-encodes, and strips private metadata', async () => {
        const source = await sharp({
            create: {
                width: 1800,
                height: 900,
                channels: 3,
                background: '#ffaa66',
            },
        })
            .withExif({ IFD0: { Artist: 'private' } })
            .jpeg()
            .toBuffer();
        const output = await normalizeAnimalPhoto(source);
        const metadata = await sharp(output).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBe(1600);
        expect(metadata.exif).toBeUndefined();
    });
    it.each([
        Buffer.from('not an image'),
        Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
        ),
    ])('rejects fake and vector input', async (input) => {
        await expect(normalizeAnimalPhoto(input)).rejects.toMatchObject({
            code: 'INVALID_PHOTO',
        });
    });
    it('rejects oversized input before decoding', async () => {
        await expect(
            normalizeAnimalPhoto(Buffer.alloc(5 * 1024 * 1024 + 1)),
        ).rejects.toMatchObject({ code: 'INVALID_PHOTO' });
    });
});
