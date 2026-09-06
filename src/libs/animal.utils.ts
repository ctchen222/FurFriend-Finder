function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split('/').map(Number);
	const mm = month.toString().padStart(2, '0');
	const dd = day.toString().padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

function convertMinguoToGregorian(minguoDate: string): string | null {
	if (!minguoDate || minguoDate.length < 7) {
		return null;
	}
	try {
		const year = parseInt(minguoDate.substring(0, 3)) + 1911;
		const month = minguoDate.substring(3, 5);
		const day = minguoDate.substring(5, 7);
		const date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
		if (isNaN(date.getTime()) || date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
			return null;
		}
		return `${year}-${month}-${day}`;
	} catch (error) {
		return null;
	}
}

/** Normalize the two public-data date formats without inventing a sentinel date. */
function normalizeSourceDate(value: string | null | undefined): string | null {
	const raw = value?.trim() ?? '';
	if (!raw) return null;
	if (/^\d{7}$/.test(raw)) return convertMinguoToGregorian(raw);
	const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
	if (!match) return null;
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
		return null;
	}
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export {
	formatDate,
	convertMinguoToGregorian,
	normalizeSourceDate,
}
