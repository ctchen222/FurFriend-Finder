/// <reference path="../global.d.ts" />

class CustomError extends Error {
	name: string
	code: number
	message: string
	httpCode: number

	constructor({ code, httpCode, msg }: Api.Error) {
		super()
		this.name = 'CustomError'
		this.code = code
		this.message = msg
		this.httpCode = httpCode
	}
}

export default CustomError