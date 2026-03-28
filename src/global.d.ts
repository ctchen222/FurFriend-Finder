declare namespace Api {
	interface Error {
		code: number
		httpCode: number
		err?: any
		msg: string
	}

	interface Response {
		success: boolean
		extras?: any
		error?: Error
	}

	interface Callback {
		(err: any, response: any): void
	}

	interface ResCallback {
		(err: any, response: Response): void
	}
}

declare module 'express-session' {
	export interface Session {
		user: IUser
	}

	interface IUser {
		id: number
		name?: string
		account: string
		auth: number
	}
}
