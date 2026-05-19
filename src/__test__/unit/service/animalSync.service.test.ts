const mockSetLostAnimalInventory = jest.fn();
const mockSetAnimalSyncLastSuccessTimestamp = jest.fn();
const mockAnimalSyncRunsAdd = jest.fn();
const mockAnimalSyncDurationRecord = jest.fn();
const mockAnimalSyncUpdatedRowsAdd = jest.fn();
const mockAnimalSyncApiFailuresAdd = jest.fn();
const mockRecordAnimalSyncApiRequest = jest.fn(
  async (source: string, work: () => Promise<unknown>) => {
    try {
      return await work();
    } catch (error) {
      mockAnimalSyncApiFailuresAdd(1, { source });
      throw error;
    }
  },
);
const mockRecordAnimalSyncRun = jest.fn(
  async (source: string, table: string, work: () => Promise<number>) => {
    let status = 'error';
    try {
      const updatedRows = await work();
      mockAnimalSyncUpdatedRowsAdd(updatedRows, { table });
      mockSetAnimalSyncLastSuccessTimestamp(source);
      status = 'success';
      return updatedRows;
    } finally {
      mockAnimalSyncRunsAdd(1, { status, source });
      mockAnimalSyncDurationRecord(0, { source });
    }
  },
);

jest.mock('axios');
jest.mock('../../../config/metrics', () => ({
  animalSyncApiFailuresCounter: { add: (...args: unknown[]) => mockAnimalSyncApiFailuresAdd(...args) },
  animalSyncDurationHistogram: { record: (...args: unknown[]) => mockAnimalSyncDurationRecord(...args) },
  animalSyncRunsCounter: { add: (...args: unknown[]) => mockAnimalSyncRunsAdd(...args) },
  animalSyncUpdatedRowsCounter: { add: (...args: unknown[]) => mockAnimalSyncUpdatedRowsAdd(...args) },
  registerDbPoolGauge: jest.fn(),
  recordAnimalSyncApiRequest: (...args: unknown[]) => mockRecordAnimalSyncApiRequest(...args),
  recordDbOperation: (_operation: string, work: () => Promise<unknown>) => work(),
  recordAnimalSyncRun: (...args: unknown[]) => mockRecordAnimalSyncRun(...args),
  safeMetricAttributes: (attributes: Record<string, unknown>) => attributes,
  setAnimalSyncLastSuccessTimestamp: (...args: unknown[]) => mockSetAnimalSyncLastSuccessTimestamp(...args),
  setLostAnimalInventory: (...args: unknown[]) => mockSetLostAnimalInventory(...args),
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

import axios from 'axios';
import AnimalSyncService from '../../../Service/animalSync';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnimalSyncService', () => {
  let service: AnimalSyncService;
  let mockBulkInsert: jest.Mock;
  let mockCountLostAnimalsByCounty: jest.Mock;

  beforeEach(() => {
    mockBulkInsert = jest.fn();
    mockCountLostAnimalsByCounty = jest.fn().mockResolvedValue({ 臺北市: 3 });
    mockSetLostAnimalInventory.mockClear();
    mockSetAnimalSyncLastSuccessTimestamp.mockClear();
    mockAnimalSyncRunsAdd.mockClear();
    mockAnimalSyncDurationRecord.mockClear();
    mockAnimalSyncUpdatedRowsAdd.mockClear();
    mockAnimalSyncApiFailuresAdd.mockClear();
    mockRecordAnimalSyncApiRequest.mockClear();
    mockRecordAnimalSyncRun.mockClear();
    mockRecordAnimalSyncApiRequest.mockImplementation(
      async (source: string, work: () => Promise<unknown>) => {
        try {
          return await work();
        } catch (error) {
          mockAnimalSyncApiFailuresAdd(1, { source });
          throw error;
        }
      },
    );
    mockRecordAnimalSyncRun.mockImplementation(
      async (source: string, table: string, work: () => Promise<number>) => {
        let status = 'error';
        try {
          const updatedRows = await work();
          mockAnimalSyncUpdatedRowsAdd(updatedRows, { table });
          mockSetAnimalSyncLastSuccessTimestamp(source);
          status = 'success';
          return updatedRows;
        } finally {
          mockAnimalSyncRunsAdd(1, { status, source });
          mockAnimalSyncDurationRecord(0, { source });
        }
      },
    );

    const mockRepo = {
      bulkInsertAnimalLosts: mockBulkInsert,
      countLostAnimalsByCounty: mockCountLostAnimalsByCounty,
    } as any;

    service = new AnimalSyncService({ repository: mockRepo });
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
          expect.objectContaining({
            chipid: 'CHIP001',
            kind: '狗',
            lost_place: '台北市大安區',
          }),
        ])
      );
      expect(mockCountLostAnimalsByCounty).toHaveBeenCalledTimes(1);
      expect(mockSetLostAnimalInventory).toHaveBeenCalledWith({ 臺北市: 3 });
      expect(mockAnimalSyncUpdatedRowsAdd).toHaveBeenCalledWith(3, { table: 'animal_lost' });
      expect(mockSetAnimalSyncLastSuccessTimestamp).toHaveBeenCalledWith('lost_animals_api');
      expect(mockAnimalSyncRunsAdd).toHaveBeenCalledWith(1, {
        status: 'success',
        source: 'lost_animals_api',
      });
      expect(mockAnimalSyncDurationRecord).toHaveBeenCalledWith(expect.any(Number), {
        source: 'lost_animals_api',
      });
      expect(count).toBe(3);
    });

    it('should throw Error when API data fails Zod validation', async () => {
      mockedAxios.get.mockResolvedValue({ data: 'not an array' });

      await expect(service.updateTableAnimalLosts()).rejects.toThrow('Invalid data format');
      expect(mockAnimalSyncRunsAdd).toHaveBeenCalledWith(1, {
        status: 'error',
        source: 'lost_animals_api',
      });
    });

    it('should count public-data API failures when the request fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(service.updateTableAnimalLosts()).rejects.toThrow('Network error');
      expect(mockAnimalSyncApiFailuresAdd).toHaveBeenCalledWith(1, {
        source: 'lost_animals_api',
      });
    });
  });
});
