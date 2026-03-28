type ApiResult = { [x: string]: unknown }
type TextResult = string
type HtmlResult = string
type RedirectResult = string

type ResultType = {
	api: ApiResult
	text: TextResult
	html: HtmlResult
	redirect: RedirectResult
}

class SuccessResponse<T extends keyof ResultType> {
	success: boolean = true
	type: T
	extras?: ResultType[T] | null

	constructor(type: T, result?: ResultType[T]) {
		this.type = type
		this.extras = result ?? null
	}
}

export default SuccessResponse
