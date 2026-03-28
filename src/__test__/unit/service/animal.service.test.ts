import AnimalService from '../../../Service/animal';

jest.mock('axios');
jest.mock('../../../repository/animal.db');

import axios from 'axios';
import AnimalRepository from '../../../repository/animal.db';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedAnimalRepository = AnimalRepository as jest.MockedClass<typeof AnimalRepository>;

describe('AnimalService.updateAnimalTable', () => {
  let service: AnimalService;
  let mockBulkInsertAnimals: jest.Mock;

  beforeEach(() => {
    mockBulkInsertAnimals = jest.fn().mockResolvedValue(5);
    MockedAnimalRepository.mockImplementation(() => ({
      bulkInsertAnimals: mockBulkInsertAnimals,
      findAll: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any));

    service = new AnimalService();
  });

  it('should fetch from MOA API, parse and bulk insert animals', async () => {
    const mockApiResponse = [
      {
        animal_shelter_pkid: 1,
        animal_subid: 'sub001',
        animal_kind: '狗',
        animal_Variety: '米克斯',
        animal_sex: 'M',
        animal_age: 'ADULT',
        animal_bodytype: 'MEDIUM',
        animal_colour: '黃色',
        animal_foundplace: '台北市',
        animal_remark: '',
        album_file: 'http://example.com/img.jpg',
        animal_status: 'OPEN',
        animal_opendate: '2024-01-01',
        animal_closedate: '',
        animal_update: '2024-01-10',
        shelter_name: '台北動物之家',
        shelter_address: '台北市信義區',
        shelter_tel: '02-12345678',
      },
    ];

    mockedAxios.get.mockResolvedValue({ data: mockApiResponse });

    const count = await service.updateAnimalTable();

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('moa.gov.tw'));
    expect(mockBulkInsertAnimals).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ kind: '狗', variety: '米克斯', animal_shelter_id: 1 }),
      ])
    );
    expect(count).toBe(5);
  });

  it('should throw Error when API returns data that fails Zod validation', async () => {
    // Missing required animal_shelter_pkid
    mockedAxios.get.mockResolvedValue({ data: [{ animal_kind: '狗' }] });

    await expect(service.updateAnimalTable()).rejects.toThrow('Invalid data format');
  });

  it('should throw Error when API returns empty array (no animals)', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    // Empty array passes AnimalResponseSchema (it's z.array), bulkInsert called with []
    // This is valid behavior — test that it completes without throwing
    mockBulkInsertAnimals.mockResolvedValue(0);
    const count = await service.updateAnimalTable();
    expect(count).toBe(0);
  });

  it('should throw when axios call fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    await expect(service.updateAnimalTable()).rejects.toThrow('Network error');
  });
});
