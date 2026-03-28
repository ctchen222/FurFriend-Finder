import GeoService from '../../../Service/geo';
import CustomError from '../../../libs/customError';
import * as apiMessage from '../../../libs/message';
import { Client } from '@googlemaps/google-maps-services-js';

// Mock the entire module
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn(),
}));

const MockedClient = Client as jest.MockedClass<typeof Client>;

describe('GeoService', () => {
  let service: GeoService;
  let mockGeocode: jest.Mock;

  beforeEach(() => {
    // Re-setup Client mock in beforeEach because resetMocks:true clears implementations
    mockGeocode = jest.fn();
    MockedClient.mockImplementation(() => ({
      geocode: mockGeocode,
      directions: jest.fn(),
      distancematrix: jest.fn(),
      elevation: jest.fn(),
      geolocate: jest.fn(),
      places: jest.fn(),
      reverseGeocode: jest.fn(),
      snapToRoads: jest.fn(),
      timezone: jest.fn(),
    } as any));
    service = new GeoService();
  });

  describe('geocoding', () => {
    it('should return {lat, lng} for OK status', async () => {
      mockGeocode.mockResolvedValue({
        data: {
          status: 'OK',
          results: [{ geometry: { location: { lat: 25.04, lng: 121.51 } } }],
        },
      });

      const result = await service.geocoding('台北市信義區');
      expect(result).toEqual({ lat: 25.04, lng: 121.51 });
    });

    it('should return null for ZERO_RESULTS status', async () => {
      mockGeocode.mockResolvedValue({
        data: { status: 'ZERO_RESULTS', results: [] },
      });

      const result = await service.geocoding('不存在的地址XYZ123');
      expect(result).toBeNull();
    });

    it('should throw CustomError with GEOCODING_RATE_LIMIT for OVER_QUERY_LIMIT', async () => {
      mockGeocode.mockResolvedValue({
        data: { status: 'OVER_QUERY_LIMIT', results: [] },
      });

      await expect(service.geocoding('some address')).rejects.toMatchObject({
        code: apiMessage.GEOCODING_RATE_LIMIT.code,
        httpCode: apiMessage.GEOCODING_RATE_LIMIT.httpCode,
      });
    });

    it('should throw CustomError with INVALID_CREDENTIALS for REQUEST_DENIED', async () => {
      mockGeocode.mockResolvedValue({
        data: { status: 'REQUEST_DENIED', results: [] },
      });

      await expect(service.geocoding('some address')).rejects.toMatchObject({
        code: apiMessage.INVALID_CREDENTIALS.code,
        httpCode: apiMessage.INVALID_CREDENTIALS.httpCode,
      });
    });

    it('should throw CustomError with GEOCODING_FAILED for unknown status', async () => {
      mockGeocode.mockResolvedValue({
        data: { status: 'UNKNOWN_ERROR', results: [] },
      });

      await expect(service.geocoding('some address')).rejects.toMatchObject({
        code: apiMessage.GEOCODING_FAILED.code,
      });
    });

    it('should throw CustomError with GEOCODING_FAILED when client throws network error', async () => {
      mockGeocode.mockRejectedValue(new Error('Network timeout'));

      await expect(service.geocoding('some address')).rejects.toMatchObject({
        code: apiMessage.GEOCODING_FAILED.code,
      });
    });
  });

  describe('calculateDistanceKm (static)', () => {
    it('should return 0 for same point', () => {
      const point = { lat: 25.04, lng: 121.51 };
      expect(GeoService.calculateDistanceKm(point, point)).toBe(0);
    });

    it('should return a positive number for two different points', () => {
      const taipei = { lat: 25.04, lng: 121.51 };
      const taichung = { lat: 24.14, lng: 120.68 };
      expect(GeoService.calculateDistanceKm(taipei, taichung)).toBeGreaterThan(0);
    });

    it('should return approximately 300km between Taipei and Kaohsiung', () => {
      const taipei = { lat: 25.04, lng: 121.51 };
      const kaohsiung = { lat: 22.62, lng: 120.30 };
      const result = GeoService.calculateDistanceKm(taipei, kaohsiung);
      // 台北到高雄直線距離約 300-340 km，允許範圍 280-380
      expect(result).toBeGreaterThan(280);
      expect(result).toBeLessThan(380);
    });
  });
});
