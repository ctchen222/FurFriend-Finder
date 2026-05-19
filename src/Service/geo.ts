import { Client, GeocodeRequest } from "@googlemaps/google-maps-services-js";
import { getDistance } from "geolib";
import CustomError from "../libs/customError";
import * as apiMessage from '../libs/message'
import { locationSchema } from "../libs/zod/geo";
import {
	recordGeocodingRequest,
} from "../config/metrics";

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

		return recordGeocodingRequest(async (setMetricStatus) => {
			try {
				const { data } = await this.client.geocode(geocodeRequest);

				switch (data.status) {
					case 'OK': {
						const location = data.results[0].geometry.location;
						const parsedLocation = locationSchema.parse(location);
						setMetricStatus('ok');
						return parsedLocation;
					}
					case 'ZERO_RESULTS':
						setMetricStatus('zero_results');
						return null;
					case 'OVER_QUERY_LIMIT':
						setMetricStatus('over_query_limit');
						throw new CustomError(apiMessage.GEOCODING_RATE_LIMIT);
					case 'REQUEST_DENIED':
						setMetricStatus('request_denied');
						throw new CustomError(apiMessage.INVALID_CREDENTIALS);
					default:
						setMetricStatus('error');
						throw new CustomError(apiMessage.GEOCODING_FAILED);
				}
			} catch (error) {
				if (error instanceof CustomError) {
					throw error;
				}
				setMetricStatus('error');
				throw new CustomError(apiMessage.GEOCODING_FAILED);
			}
		});
	}

	static calculateDistanceKm(
		origin: { lat: number; lng: number },
		destination: { lat: number; lng: number }
	): number {
		const distanceInMeters = getDistance(
			{ latitude: origin.lat, longitude: origin.lng },
			{ latitude: destination.lat, longitude: destination.lng }
		);
		return parseFloat((distanceInMeters / 1000).toFixed(2));
	}
}

export default GeoService;
