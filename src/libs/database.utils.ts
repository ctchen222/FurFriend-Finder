import { Animal } from "./zod/animals";

class DatabaseUtils {
	static encodeAnimalPageCursor(row: any): string | undefined {
		if (!row?.id) return undefined;

		return Buffer.from(
			JSON.stringify({
				id: row.id,
				update_date: row.update_date ?? null,
				open_date: row.open_date ?? null,
			}),
		).toString('base64');
	}

	static cursorPairGenerate<T>(
		data: any[],
		currentCursor: string | null = null,
		pageSize: number = 10,
	) {
		const isFirstPage = !currentCursor;
		let nextCursor, prevCursor: string | undefined;
		if (data[0]?.id && !isFirstPage) {
			prevCursor = DatabaseUtils.encodeAnimalPageCursor(data[0]);
		}
		if (data.length === pageSize) {
			nextCursor = DatabaseUtils.encodeAnimalPageCursor(data[data.length - 1]);
		}

		return {
			prevCursor,
			nextCursor
		}
	}
}

export default DatabaseUtils;
