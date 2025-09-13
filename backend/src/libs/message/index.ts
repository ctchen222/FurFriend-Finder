export const ANIMAL_NOT_EXISTS: Api.Error = {
	code: 101,
	httpCode: 400,
	msg: "Animal does not exist"
}

export const ANIMAL_LOST_NOT_EXISTS: Api.Error = {
	code: 102,
	httpCode: 400,
	msg: "Animal lost record does not exist"
}

export const INVALID_CREDENTIALS: Api.Error = {
	code: 201,
	httpCode: 401,
	msg: "Invalid credentials"
}

export const GEOCODING_RATE_LIMIT: Api.Error = {
	code: 202,
	httpCode: 429,
	msg: "Geocoding API query limit has been reached"
}

export const GEOCODING_FAILED: Api.Error = {
	code: 203,
	httpCode: 500,
	msg: "Geocoding service failed"
}

export const LOST_PLACE_NOT_FOUND: Api.Error = {
	code: 301,
	httpCode: 400,
	msg: "Lost place address not found"
}

export const VALIDATION_ERROR: Api.Error = {
	code: 400,
	httpCode: 400,
	msg: "Invalid input data"
}

export const ID_MUST_PROVIDED: Api.Error = {
	code: 401,
	httpCode: 400,
	msg: "ID must be provided"
}

export const CONTENT_NOT_FOUND: Api.Error = {
	code: 402,
	httpCode: 404,
	msg: "Content not found"
}

export const MISSING_REQUIRED_FIELDS: Api.Error = {
	code: 403,
	httpCode: 400,
	msg: "Missing required fields"
}

export const LOGIN_FAILURE: Api.Error = {
	code: 501,
	httpCode: 401,
	msg: "Login failed, invalid email or password"
}

export const LOGOUT_FAILURE: Api.Error = {
	code: 502,
	httpCode: 500,
	msg: "Logout failed"
}

export const BODY_NOT_COMPLETE: Api.Error = {
	code: 601,
	httpCode: 400,
	msg: "Request body is not complete"
}
