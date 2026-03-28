import { Animal } from "./zod/animals";

class DatabaseUtils {

	static cursorPairGenerate<T>(
		data: any[],
		currentCursor: string | null = null,
		pageSize: number = 10,
	) {
		const firstElementId = data[0]?.id;
		const lastElementId = data[data.length - 1]?.id;
		const isFirstPage = !currentCursor;
		let nextCursor, prevCursor: string | undefined;
		if (firstElementId && !isFirstPage) {
			prevCursor = Buffer.from(JSON.stringify({ "id": firstElementId - 1 })).toString('base64');
		}
		if (lastElementId && data.length === pageSize) {
			nextCursor = Buffer.from(JSON.stringify({ "id": lastElementId })).toString('base64');
		}

		return {
			prevCursor,
			nextCursor
		}
	}
}

export default DatabaseUtils;
