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

		// console.log('Request Headers:', req.headers); // Keep this for debugging if needed
		const session = await auth.api.getSession({
			headers: headers, // Pass the constructed Headers object
		});
		console.log('Session retrieved:', session); // Log the session
		res.locals.user = session ? session.user : null;
	} catch (error) {
		console.error('Error getting session:', error); // Log the error
		res.locals.user = null;
	}
	next();
};