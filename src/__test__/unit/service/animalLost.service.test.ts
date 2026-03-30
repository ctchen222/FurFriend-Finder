import AnimalLostService from '../../../Service/animalLost';
import GeoService from '../../../Service/geo';
import * as apiMessage from '../../../libs/message';

// Side-effect modules that cannot be constructor-injected
jest.mock('axios');
jest.mock('../../../config/mail', () => ({
  default: { sentFrom: 'test@furfinder.com' },
  __esModule: true,
}));
jest.mock('fs-extra', () => ({
  readFile: jest.fn().mockResolvedValue('<html>{{userName}}</html>'),
}));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
  matchLogger: { http: jest.fn() },
}));

import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildMockAnimalLost(overrides = {}) {
  return {
    id: '1',
    owner_id: 'o1',
    name: '小黑',
    colour: '黑色',
    kind: '狗',
    sex: 'M',
    variety: '拉布拉多',
    lost_place: '台北市信義區',
    ...overrides,
  };
}

function buildMockOwner(overrides = {}) {
  return {
    id: 'o1',
    name: '王小明',
    email: 'owner@example.com',
    phone: '0912345678',
    ...overrides,
  };
}

describe('AnimalLostService', () => {
  let service: AnimalLostService;
  let mockFindById: jest.Mock;
  let mockOwnerFindById: jest.Mock;
  let mockFindMatchingAnimals: jest.Mock;
  let mockGeocoding: jest.Mock;
  let mockSendMatchedMail: jest.Mock;
  let mockBulkInsert: jest.Mock;

  beforeEach(() => {
    mockFindById = jest.fn();
    mockOwnerFindById = jest.fn();
    mockFindMatchingAnimals = jest.fn();
    mockGeocoding = jest.fn();
    mockSendMatchedMail = jest.fn().mockResolvedValue({});
    mockBulkInsert = jest.fn();

    // Static method mock — must be set before service construction
    (GeoService.calculateDistanceKm as jest.Mock) = jest.fn().mockReturnValue(10);

    const mockRepo = {
      findById: mockFindById,
      findMatchingAnimals: mockFindMatchingAnimals,
      bulkInsertAnimalLosts: mockBulkInsert,
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    const mockOwnerRepo = {
      findById: mockOwnerFindById,
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    const mockGeoService = { geocoding: mockGeocoding } as any;
    const mockMailService = { sendMatchedMail: mockSendMatchedMail } as any;

    service = new AnimalLostService({
      repository: mockRepo,
      ownerRepository: mockOwnerRepo,
      geoService: mockGeoService,
      mailService: mockMailService,
    });
  });

  describe('findMatchesAndSendMail', () => {
    it('should return lostAnimal, top10Matches and send mail when owner has email', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner());
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台北市大安區', shelter_address: '台北市大安區' },
      ]);

      const result = await service.findMatchesAndSendMail('1');

      expect(result.lostAnimal).toBeDefined();
      expect(result.top10Matches).toHaveLength(1);
      expect(mockSendMatchedMail).toHaveBeenCalledWith(
        'owner@example.com',
        '王小明',
        expect.any(Array)
      );
    });

    it('should throw CONTENT_NOT_FOUND when lost animal does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.findMatchesAndSendMail('999')).rejects.toMatchObject({
        code: apiMessage.CONTENT_NOT_FOUND.code,
      });
    });

    it('should throw CONTENT_NOT_FOUND when owner does not exist', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(null);

      await expect(service.findMatchesAndSendMail('1')).rejects.toMatchObject({
        code: apiMessage.CONTENT_NOT_FOUND.code,
      });
    });

    it('should throw LOST_PLACE_NOT_FOUND when geocoding returns null', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner());
      mockGeocoding.mockResolvedValue(null);

      await expect(service.findMatchesAndSendMail('1')).rejects.toMatchObject({
        code: apiMessage.LOST_PLACE_NOT_FOUND.code,
      });
    });

    it('should NOT send mail when owner has no email', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner({ email: null }));
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      mockFindMatchingAnimals.mockResolvedValue([{ id: 'a1', found_place: '台北市', shelter_address: '台北市' }]);

      await service.findMatchesAndSendMail('1');

      expect(mockSendMatchedMail).not.toHaveBeenCalled();
    });

    it('should return only top 10 matches when more than 10 animals matched', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner({ email: null }));
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });

      const manyAnimals = Array.from({ length: 15 }, (_, i) => ({
        id: `a${i}`,
        found_place: `台北市區域${i}`,
        shelter_address: `台北市區域${i}`,
      }));
      mockFindMatchingAnimals.mockResolvedValue(manyAnimals);

      const result = await service.findMatchesAndSendMail('1');

      expect(result.top10Matches.length).toBeLessThanOrEqual(10);
    });
  });

  describe('findMatches', () => {
    it('should return matched animals sorted by distance', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(10);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台中', shelter_address: '台中市' },
        { id: 'a2', found_place: '台北市', shelter_address: '台北市' },
      ]);

      const result = await service.findMatches({
        kind: '狗', colour: '黑', sex: 'M', variety: '', lost_place: '台北市信義區',
      });

      // a2 (distance 10) should come before a1 (distance 50)
      expect(result.matchedAnimals[0].id).toBe('a2');
    });

    it('should throw LOST_PLACE_NOT_FOUND when geocoding returns null', async () => {
      mockGeocoding.mockResolvedValue(null);

      await expect(
        service.findMatches({ kind: '狗', colour: '', sex: '', variety: '', lost_place: '不存在' })
      ).rejects.toMatchObject({ code: apiMessage.LOST_PLACE_NOT_FOUND.code });
    });

    it('should deduplicate geocoding calls for animals sharing the same found_place', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(5);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台北市大安區', shelter_address: '台北市大安區' },
        { id: 'a2', found_place: '台北市大安區', shelter_address: '台北市大安區' },
        { id: 'a3', found_place: '新北市板橋區', shelter_address: '新北市板橋區' },
      ]);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.matchedAnimals).toHaveLength(3);
      // Geocoding: 1 for lost_place + 2 unique shelter_addresses = 3 total
      expect(mockGeocoding).toHaveBeenCalledTimes(3);
    });

    it('should exclude animals whose found_place geocoding throws an error', async () => {
      mockGeocoding
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 });

      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(10);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '台中', shelter_address: '台中市' },
        { id: 'a2', found_place: '台北市', shelter_address: '台北市' },
      ]);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.matchedAnimals).toHaveLength(1);
      expect(result.matchedAnimals[0].id).toBe('a2');
    });

    it('should assign Infinity distance when found_place geocoding returns null (ZERO_RESULTS)', async () => {
      mockGeocoding
        .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 })
        .mockResolvedValueOnce(null);

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '火星市', shelter_address: '火星市' },
      ]);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.matchedAnimals).toHaveLength(1);
      expect(result.matchedAnimals[0].distance).toBe(Infinity);
    });

    it('should assign Infinity distance when candidate animal has empty or null found_place', async () => {
      mockGeocoding.mockResolvedValueOnce({ lat: 25.04, lng: 121.51 });

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: '', shelter_address: '' },
        { id: 'a2', found_place: null, shelter_address: null },
      ]);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.matchedAnimals).toHaveLength(2);
      expect(result.matchedAnimals[0].distance).toBe(Infinity);
      expect(result.matchedAnimals[1].distance).toBe(Infinity);
      expect(mockGeocoding).toHaveBeenCalledTimes(1);
    });

    it('should sort all animals with Infinity distance stably when no found_place resolves', async () => {
      mockGeocoding.mockResolvedValueOnce({ lat: 25.04, lng: 121.51 });

      mockFindMatchingAnimals.mockResolvedValue([
        { id: 'a1', found_place: null, shelter_address: null },
        { id: 'a2', found_place: '', shelter_address: '' },
        { id: 'a3', found_place: null, shelter_address: null },
      ]);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.matchedAnimals).toHaveLength(3);
      result.matchedAnimals.forEach((animal) => {
        expect(animal.distance).toBe(Infinity);
      });
    });

    it('should only geocode first 200 candidates but report original total in metadata (GEOCODING_BATCH_LIMIT)', async () => {
      mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
      (GeoService.calculateDistanceKm as jest.Mock).mockReturnValue(5);

      const manyAnimals = Array.from({ length: 250 }, (_, i) => ({
        id: `a${i}`,
        found_place: `地點${i}`,
        shelter_address: `地點${i}`,
      }));
      mockFindMatchingAnimals.mockResolvedValue(manyAnimals);

      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(result.metadata.total).toBe(250);
      // 1 (lost_place) + 200 unique shelter_addresses = 201 total geocoding calls
      expect(mockGeocoding).toHaveBeenCalledTimes(201);
    });
  });

  describe('updateTableAnimalLosts', () => {
    it('should fetch from MOA API, parse and bulk insert lost animals', async () => {
      mockBulkInsert.mockResolvedValue(3);

      const mockApiData = [
        {
          晶片號碼: 'CHIP001',
          寵物名: '小黑',
          寵物別: '狗',
          性別: '公',
          品種: '拉布拉多',
          毛色: '黑色',
          遺失地點: '台北市大安區',
        },
      ];
      mockedAxios.get.mockResolvedValue({ data: mockApiData });

      const count = await service.updateTableAnimalLosts();

      expect(mockBulkInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ chipid: 'CHIP001', kind: '狗', lost_place: '台北市大安區' }),
        ])
      );
      expect(count).toBe(3);
    });

    it('should throw Error when API data fails Zod validation', async () => {
      mockedAxios.get.mockResolvedValue({ data: 'not an array' });

      await expect(service.updateTableAnimalLosts()).rejects.toThrow('Invalid data format');
    });
  });
});
