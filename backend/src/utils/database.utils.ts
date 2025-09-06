import { Animal } from "./zod/animals";

class DatabaseUtils {

	static cursorPairGenerate<T>(
		data: any[],
		page: number = 1,
		pageSize: number = 10,
	) {
		const firstElementId = data[0]?.id;
		const lastElementId = data[data.length - 1]?.id;
		let nextCursor, prevCursor: string | undefined;
		if (firstElementId && page > 1) {
			prevCursor = Buffer.from(JSON.stringify({ "id": firstElementId })).toString('base64');
		}
		if (lastElementId) {
			nextCursor = Buffer.from(JSON.stringify({ "id": lastElementId })).toString('base64');
		}

		return {
			prevCursor,
			nextCursor
		}
	}
}

export default DatabaseUtils;
