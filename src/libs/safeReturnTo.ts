const ALLOWED_RETURN_PATHS = new Set(['/','/profile','/report-lost','/quick-use']);

export function safeReturnTo(value: unknown): string {
	if (typeof value !== 'string') return '/';
	try {
		const decoded = decodeURIComponent(value);
		if (decoded.includes('\\') || decoded.startsWith('//')) return '/';
		const path = new URL(decoded, 'http://localhost').pathname;
		return decoded === path && ALLOWED_RETURN_PATHS.has(path) ? path : '/';
	} catch {
		return '/';
	}
}
