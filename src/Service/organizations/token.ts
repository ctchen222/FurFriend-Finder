import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const tokenPattern =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

function secret(): string {
    const value = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
    if (!value || value.length < 32)
        throw new Error('Organization token secret is not configured');
    return value;
}

export function createOrganizationToken(
    kind: 'invite' | 'transfer',
    id: string,
): string {
    const signature = createHmac('sha256', secret())
        .update(`${kind}:${id}`)
        .digest('base64url');
    return `${id}.${signature}`;
}

export function parseOrganizationToken(
    kind: 'invite' | 'transfer',
    token: string,
): string | null {
    const match = token.match(tokenPattern);
    if (!match) return null;
    const expected = createOrganizationToken(kind, match[1]);
    const left = Uint8Array.from(Buffer.from(token));
    const right = Uint8Array.from(Buffer.from(expected));
    return left.length === right.length && timingSafeEqual(left, right)
        ? match[1]
        : null;
}

export const hashOrganizationToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');
