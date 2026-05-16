import express from 'express';

class AnimalHelper {
	static getQueryString(req: express.Request) {
		let id: string | undefined = undefined
		const { cursor, pageSize } = req.query;
		const parsedPageSize = pageSize ? parseInt(pageSize as string, 10) : 10;
		const parsedCursor = cursor ? (cursor as string) : null;
		let cursorData: { id?: number; update_date?: string | null; open_date?: string | null } | undefined;

		if (parsedCursor) {
			const decodedCursor = JSON.parse(Buffer.from(parsedCursor, 'base64').toString('ascii'));
			cursorData = decodedCursor;
			id = decodedCursor.id?.toString();
		}
		return { parsedPageSize, id, parsedCursor, cursorData };
	}
}

export default AnimalHelper;
