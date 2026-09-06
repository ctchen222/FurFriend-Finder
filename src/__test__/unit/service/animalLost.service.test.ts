import AnimalLostService from '../../../Service/animalLost';
import * as apiMessage from '../../../libs/message';

// Side-effect modules that cannot be constructor-injected
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
jest.mock('../../../config/metrics', () => {
  const matchDurationHistogram = { record: jest.fn() };
  return {
    matchDurationHistogram,
    recordMatchFlow: async (_work: () => Promise<unknown>) => {
      try {
        return await _work();
      } finally {
        matchDurationHistogram.record(0, { boundary: 'match_flow' });
      }
    },
    safeMetricAttributes: (attributes: Record<string, unknown>) => attributes,
    registerDbPoolGauge: jest.fn(),
  };
});

import { matchDurationHistogram } from '../../../config/metrics';

const mockMatchDurationRecord = matchDurationHistogram.record as jest.Mock;

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

function buildMockMatchResult(overrides = {}) {
  return {
    metadata: { total: 1 },
    top10Matches: [{ id: 'a1', found_place: '台北市大安區', distance: 5 }],
    allCandidates: [{ id: 'a1', found_place: '台北市大安區' }],
    ...overrides,
  };
}

describe('AnimalLostService', () => {
  let service: AnimalLostService;
  let mockFindById: jest.Mock;
  let mockOwnerFindById: jest.Mock;
  let mockSendMatchedMail: jest.Mock;
  let mockPerformMatch: jest.Mock;

  beforeEach(() => {
    mockFindById = jest.fn();
    mockOwnerFindById = jest.fn();
    mockSendMatchedMail = jest.fn().mockResolvedValue({});
    mockPerformMatch = jest.fn().mockResolvedValue(buildMockMatchResult());
    mockMatchDurationRecord.mockClear();

    const mockRepo = {
      findById: mockFindById,
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

    const mockMatchingService = { performMatch: mockPerformMatch } as any;
    const mockMailService = { sendMatchedMail: mockSendMatchedMail } as any;

    service = new AnimalLostService({
      repository: mockRepo,
      ownerRepository: mockOwnerRepo,
      matchingService: mockMatchingService,
      mailService: mockMailService,
    });
  });

  describe('findMatchesAndSendMail', () => {
    it('should return lostAnimal, top10Matches and send mail when owner has email', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner());

      const result = await service.findMatchesAndSendMail('1');

      expect(result.lostAnimal).toBeDefined();
      expect(result.top10Matches).toHaveLength(1);
      expect(mockPerformMatch).toHaveBeenCalledTimes(1);
      expect(mockSendMatchedMail).toHaveBeenCalledWith(
        'owner@example.com',
        '王小明',
        expect.any(Array)
      );
      expect(mockMatchDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'match_flow' });
    });

    it('should throw CONTENT_NOT_FOUND when lost animal does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.findMatchesAndSendMail('999')).rejects.toMatchObject({
        code: apiMessage.CONTENT_NOT_FOUND.code,
      });
      expect(mockMatchDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'match_flow' });
    });

    it('should throw CONTENT_NOT_FOUND when owner does not exist', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(null);

      await expect(service.findMatchesAndSendMail('1')).rejects.toMatchObject({
        code: apiMessage.CONTENT_NOT_FOUND.code,
      });
      expect(mockMatchDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'match_flow' });
    });

    it('should NOT send mail when owner has no email', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner({ email: null }));

      await service.findMatchesAndSendMail('1');

      expect(mockSendMatchedMail).not.toHaveBeenCalled();
    });

    it('should NOT send mail when no matches found', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner());
      mockPerformMatch.mockResolvedValue(buildMockMatchResult({ top10Matches: [], allCandidates: [] }));

      await service.findMatchesAndSendMail('1');

      expect(mockSendMatchedMail).not.toHaveBeenCalled();
    });

    it('should propagate mail delivery errors when matched mail fails', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());
      mockOwnerFindById.mockResolvedValue(buildMockOwner());
      mockSendMatchedMail.mockRejectedValue(new Error('SMTP unavailable'));

      await expect(service.findMatchesAndSendMail('1')).rejects.toThrow('SMTP unavailable');
      expect(mockMatchDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'match_flow' });
    });
  });

  describe('findMatchesForReport', () => {
    it('searches a report without sending email', async () => {
      mockFindById.mockResolvedValue(buildMockAnimalLost());

      const result = await service.findMatchesForReport('1');

      expect(result.lostAnimal).toBeDefined();
      expect(result.top10Matches).toHaveLength(1);
      expect(mockSendMatchedMail).not.toHaveBeenCalled();
      expect(mockOwnerFindById).not.toHaveBeenCalled();
    });
  });

  describe('findMatches', () => {
    it('should delegate to matchingService.performMatch and return matchedAnimals', async () => {
      const result = await service.findMatches({ lost_place: '台北市信義區' });

      expect(mockPerformMatch).toHaveBeenCalledWith({ lost_place: '台北市信義區' });
      expect(result.matchedAnimals).toHaveLength(1);
      expect(result.metadata).toEqual({ total: 1 });
    });

    it('should propagate errors from matchingService.performMatch', async () => {
      mockPerformMatch.mockRejectedValue({ code: apiMessage.LOST_PLACE_NOT_FOUND.code });

      await expect(
        service.findMatches({ lost_place: '不存在' })
      ).rejects.toMatchObject({ code: apiMessage.LOST_PLACE_NOT_FOUND.code });
    });
  });

});
