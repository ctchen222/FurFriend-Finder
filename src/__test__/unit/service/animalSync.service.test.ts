import AnimalSyncService from '../../../Service/animalSync';

jest.mock('axios');

import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnimalSyncService', () => {
  let service: AnimalSyncService;
  let mockBulkInsert: jest.Mock;

  beforeEach(() => {
    mockBulkInsert = jest.fn();

    const mockRepo = {
      bulkInsertAnimalLosts: mockBulkInsert,
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
      expect(count).toBe(3);
    });

    it('should throw Error when API data fails Zod validation', async () => {
      mockedAxios.get.mockResolvedValue({ data: 'not an array' });

      await expect(service.updateTableAnimalLosts()).rejects.toThrow('Invalid data format');
    });
  });
});
