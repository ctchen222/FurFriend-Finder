import MatchingService from '../../../Service/matching';
import GeoService from '../../../Service/geo';
import * as apiMessage from '../../../libs/message';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
  matchLogger: { http: jest.fn() },
}));

describe('MatchingService', () => {
  let service: MatchingService;
  let mockFindMatchingAnimals: jest.Mock;
  let mockGeocoding: jest.Mock;

  beforeEach(() => {
    mockFindMatchingAnimals = jest.fn();
    mockGeocoding = jest.fn();

    (GeoService.calculateDistanceKm as jest.Mock) = jest.fn().mockReturnValue(10);

    const mockRepo = {
      findMatchingAnimals: mockFindMatchingAnimals,
    } as any;

    const mockGeoService = { geocoding: mockGeocoding } as any;

    service = new MatchingService({ repository: mockRepo, geoService: mockGeoService });
  });

  describe('performMatch — geocoding and distance pipeline', () => {
    it('should return matched animals sorted by distance', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(10);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台中' },
        { id: 'a2', found_place: '台北市' },
      ]);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      // a2 (distance 10) should come before a1 (distance 50)
      expect(result.top10Matches[0].id).toBe('a2');
    });

    it('should throw LOST_PLACE_NOT_FOUND when geocoding returns null for lost_place', async () => {
      mockGeocoding.mockResolvedValue(null);

      await expect(
        service.performMatch({ lost_place: '不存在的地點' })
      ).rejects.toMatchObject({ code: apiMessage.LOST_PLACE_NOT_FOUND.code });
    });

    it('should deduplicate geocoding calls for animals sharing the same found_place', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(5);

      // 3 animals but only 2 unique found_places
      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台北市大安區' },
        { id: 'a2', found_place: '台北市大安區' }, // same as a1
        { id: 'a3', found_place: '新北市板橋區' },
      ]);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      expect(result.top10Matches).toHaveLength(3);
      // 1 (lost_place) + 2 unique found_places = 3 total geocoding calls
      expect(mockGeocoding).toHaveBeenCalledTimes(3);
    });

    it('should exclude animals whose found_place geocoding throws an error', async () => {
      mockGeocoding
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 }) // lost_place
        .mockRejectedValueOnce(new Error('API error'))       // 台中 geocoding fails
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 }); // 台北市 succeeds

      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(10);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台中' },
        { id: 'a2', found_place: '台北市' },
      ]);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      // a1 (台中 failed) is dropped; a2 is kept
      expect(result.top10Matches).toHaveLength(1);
      expect(result.top10Matches[0].id).toBe('a2');
    });

    it('should assign Infinity distance when found_place geocoding returns null (ZERO_RESULTS)', async () => {
      mockGeocoding
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 }) // lost_place
        .mockResolvedValueOnce(null);                        // candidate: ZERO_RESULTS

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '火星市' },
      ]);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      expect(result.top10Matches).toHaveLength(1);
      expect(result.top10Matches[0].distance).toBe(Infinity);
    });

    it('should assign Infinity distance when candidate has empty or null found_place', async () => {
      mockGeocoding.mockResolvedValueOnce({ lat: 25.04, lng: 121.51 }); // lost_place only

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '' },
        { id: 'a2', found_place: null },
      ]);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      expect(result.top10Matches).toHaveLength(2);
      result.top10Matches.forEach(a => expect(a.distance).toBe(Infinity));
      // Only 1 geocoding call (for lost_place); candidates short-circuited
      expect(mockGeocoding).toHaveBeenCalledTimes(1);
    });

    it('should return only top 10 when more than 10 matches', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(5);

      mockFindMatchingAnimals.mockResolvedValue(
        Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, found_place: `地點${i}` }))
      );

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      expect(result.top10Matches.length).toBeLessThanOrEqual(10);
    });

    it('should only geocode first 200 candidates and report original total in metadata', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(5);

      const manyAnimals = Array.from({ length: 250 }, (_, i) => ({
        id: `a${i}`,
        found_place: `地點${i}`,
      }));
      mockFindMatchingAnimals.mockResolvedValue(manyAnimals);

      const result = await service.performMatch({ lost_place: '台北市信義區' });

      // metadata.total must reflect the original 250, not the truncated 200
      expect(result.metadata.total).toBe(250);
      // 1 (lost_place) + 200 unique found_places = 201 total calls
      expect(mockGeocoding).toHaveBeenCalledTimes(201);
    });
  });

  describe('performMatch — input normalization', () => {
    it('should pass normalized sex (公→M) to repository', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      mockFindMatchingAnimals.mockResolvedValue([]);

      await service.performMatch({ sex: '公', lost_place: '台北市' });

      expect(mockFindMatchingAnimals).toHaveBeenCalledWith(
        expect.anything(), // colour
        expect.anything(), // kind
        'M',               // sex normalized
        expect.anything()  // variety
      );
    });

    it('should strip trailing 犬 from kind before querying repository', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      mockFindMatchingAnimals.mockResolvedValue([]);

      await service.performMatch({ kind: '拉布拉多犬', lost_place: '台北市' });

      const [, kindArg] = mockFindMatchingAnimals.mock.calls[0];
      expect(kindArg).toBe('拉布拉多');
    });

    it('should parse colour string into array for repository query', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      mockFindMatchingAnimals.mockResolvedValue([]);

      await service.performMatch({ colour: '黑白色', lost_place: '台北市' });

      const [colourArg] = mockFindMatchingAnimals.mock.calls[0];
      expect(colourArg).toEqual(['黑白']);
    });
  });
});
