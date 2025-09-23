import { Request, Response, NextFunction } from 'express';
import { auth } from '../auth';

export const addUserToLocals = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const headers = new Headers();
		Object.entries(req.headers).forEach(([key, value]) => {
			if (value) {
				if (Array.isArray(value)) {
					value.forEach(v => headers.append(key, v));
				} else {
					headers.append(key, value);
				}
			}
		});

		const session = await auth.api.getSession({
			headers: headers, // Pass the constructed Headers object
		});
		res.locals.user = session ? session.user : null;
	} catch (error) {
		res.locals.user = null;
	}
	next();
};
