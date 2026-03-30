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
		const date = new Date(`${year}-${month}-${day}`);
		if (isNaN(date.getTime())) {
			return null;
		}
		return `${year}-${month}-${day}`;
	} catch (error) {
		return null;
	}
}

export {
	formatDate,
	convertMinguoToGregorian
}
