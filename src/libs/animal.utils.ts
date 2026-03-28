import { AnimalColourSchema, AnimalLost } from "./zod/animals";

function normalizeMatchCriteria(
	name: string | undefined,
	colour: string | undefined,
	sex: string | undefined,
	kind: string | undefined,
	variety: string | undefined,
	lost_place: string | undefined
) {
	const normalizedName = () => {
		const nName = name || '';
		return nName.trim();
	}

	const normalizedColor = () => {
		const nColor = colour || '';
		const result = AnimalColourSchema.safeParse(nColor)
		if (result.success) {
			return result.data
		}
		return undefined;
	}

	const normalizedSex = () => {
		if (sex === '公') return 'M';
		if (sex === '母') return 'F';
		return sex;
	}

	const normalizedKind = () => {
		let nKind = kind || '';
		if (nKind.endsWith('犬')) {
			nKind = nKind.slice(0, -1);
		}
		return nKind.trim();
	}

	const normalizedVariety = () => {
		let nVariety = variety || '';
		if (nVariety.endsWith('犬')) {
			nVariety = nVariety.slice(0, -1);
		}
		return nVariety.trim();
	}

	const normalizedLostPlace = () => {
		let nLostPlace = lost_place || '';
		return nLostPlace.trim();
	}

	return {
		name: normalizedName(),
		colour: normalizedColor(),
		sex: normalizedSex(),
		kind: normalizedKind(),
		variety: normalizedVariety(),
		lost_place: normalizedLostPlace(),
	};
}

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
	normalizeMatchCriteria,
	formatDate,
	convertMinguoToGregorian
}
