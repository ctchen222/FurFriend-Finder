import { AnimalColourSchema, AnimalLost } from "./zod/animals";

function normalizeMatchCriteria(lostAnimal: AnimalLost) {
	const normalizedName = () => {
		let name = lostAnimal.name || '';
		return name.trim();
	}

	const normalizedColor = () => {
		let color = lostAnimal.colour
		const result = AnimalColourSchema.safeParse(color)
		if (result.success) {
			return result.data
		}
		return undefined;
	}

	const normalizedSex = () => {
		if (lostAnimal.sex === '公') return 'M';
		if (lostAnimal.sex === '母') return 'F';
		return lostAnimal.sex;
	}

	const normalizedKind = () => {
		let kind = lostAnimal.kind || '';
		if (kind.endsWith('犬')) {
			kind = kind.slice(0, -1);
		}
		return kind.trim();
	}

	const normalizedVariety = () => {
		let variety = lostAnimal.variety || '';
		if (variety.endsWith('犬')) {
			variety = variety.slice(0, -1);
		}
		return variety.trim();
	}

	const normalizedLostPlace = () => {
		let lostPlace = lostAnimal.lost_place || '';
		return lostPlace.trim();
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
