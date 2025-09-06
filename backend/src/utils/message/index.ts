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
