import { Client, GeocodeRequest } from "@googlemaps/google-maps-services-js";
import { getDistance } from "geolib";
import CustomError from "../utils/customError";
import * as apiMessage from '../utils/message'
import { locationSchema } from "../utils/zod/geo";

class GeoService {
	client: Client;
	apiKey: string;

	constructor() {
		this.client = new Client({});
		this.apiKey = process.env.GEOCODING_API_KEY as string;
	}

	async geocoding(address: string): Promise<{ lat: number; lng: number } | null> {
		const geocodeRequest: GeocodeRequest = {
			params: {
				address,
				key: this.apiKey,
			},
		};

		const { data } = await this.client.geocode(geocodeRequest);

		switch (data.status) {
			case 'OK': {
				const location = data.results[0].geometry.location;
				const parsedLocation = locationSchema.parse(location);
				return parsedLocation;
			}
			case 'ZERO_RESULTS':
				return null;
			case 'OVER_QUERY_LIMIT':
				throw new CustomError(apiMessage.GEOCODING_RATE_LIMIT);
			case 'REQUEST_DENIED':
				throw new CustomError(apiMessage.INVALID_CREDENTIALS);
			default:
				throw new CustomError(apiMessage.GEOCODING_FAILED);
		}
	}

	static calculateDistance(
		origin: { lat: number; lng: number },
		destination: { lat: number; lng: number }
	) {
		const distance = getDistance(
			{ latitude: origin.lat, longitude: origin.lng },
			{ latitude: destination.lat, longitude: destination.lng }
		);
		return distance;
	}
}

export default GeoService;
