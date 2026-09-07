import sharp from 'sharp';
import { OrganizationError } from './errors';

export async function normalizeAnimalPhoto(input: Buffer): Promise<Buffer> {
    const invalid = () =>
        new OrganizationError(
            422,
            'INVALID_PHOTO',
            '請選擇有效的 JPG、PNG 或 WebP 照片（5 MB 以下）',
        );
    if (
        !Buffer.isBuffer(input) ||
        !input.length ||
        input.length > 5 * 1024 * 1024
    )
        throw invalid();
    // Reject non-raster containers before asking an image decoder to inspect them.
    const jpeg = input.toString('hex', 0, 3) === 'ffd8ff';
    const png = input.toString('hex', 0, 8) === '89504e470d0a1a0a';
    const webp =
        input.toString('ascii', 0, 4) === 'RIFF' &&
        input.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp) throw invalid();
    try {
        const photo = sharp(input, {
            limitInputPixels: 25_000_000,
            failOn: 'warning',
        });
        const metadata = await photo.metadata();
        if (
            !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
            (metadata.pages ?? 1) !== 1
        )
            throw invalid();
        const image = await photo
            .rotate()
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .timeout({ seconds: 5 })
            .toBuffer();
        if (image.length > 1024 * 1024) throw invalid();
        return image;
    } catch {
        throw invalid();
    }
}
