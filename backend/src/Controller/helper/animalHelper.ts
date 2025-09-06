import express from 'express';

class AnimalHelper {
	static getQueryString(req: express.Request) {
		let id: string | undefined = undefined
		const { nextCursor, pageSize } = req.query;
		const parsedPageSize = pageSize ? parseInt(pageSize as string, 10) : 10;
		const parsedCursor = nextCursor ? (nextCursor as string) : null;

		if (parsedCursor) {
			id = JSON.parse(Buffer.from(parsedCursor, 'base64').toString('ascii')).id
		}
		return { parsedPageSize, id };
	}
}

export default AnimalHelper;
