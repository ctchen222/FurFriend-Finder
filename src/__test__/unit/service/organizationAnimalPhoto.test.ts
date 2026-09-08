import sharp from 'sharp';
import { normalizeAnimalPhoto } from '../../../Service/organizations/animalPhoto';
import {
    createListingSchema,
    updateListingSchema,
} from '../../../Service/organizations/animalValidation';

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
