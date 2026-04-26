jest.mock('../../../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
    matchLogger: { http: jest.fn() },
}));

jest.mock('../../../config/metrics', () => ({
    matchRequestCounter: { add: jest.fn() },
    registerDbPoolGauge: jest.fn(),
}));

import MatchingService from '../../../Service/matching';
import GeoService from '../../../Service/geo';
import { matchRequestCounter } from '../../../config/metrics';

const mockAdd = matchRequestCounter.add as jest.Mock;

describe('MatchingService — matchRequestCounter', () => {
    let service: MatchingService;
    let mockFindMatchingAnimals: jest.Mock;
    let mockGeocoding: jest.Mock;

    beforeEach(() => {
        mockFindMatchingAnimals = jest.fn();
        mockGeocoding = jest.fn();
        mockAdd.mockClear();

        (GeoService.calculateDistanceKm as jest.Mock) = jest.fn().mockReturnValue(10);

        service = new MatchingService({
            repository: { findMatchingAnimals: mockFindMatchingAnimals } as any,
            geoService: { geocoding: mockGeocoding } as any,
        });
    });

    it('should increment matchRequestCounter with status=success on successful match', async () => {
        mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
        mockFindMatchingAnimals.mockResolvedValue([
            { id: 'a1', shelter_address: '台北市動物之家' },
        ]);

        await service.performMatch({ lost_place: '台北市信義區' });

        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'success' });
    });

    it('should increment matchRequestCounter with status=error when geocoding returns null', async () => {
        mockGeocoding.mockResolvedValue(null);

        await expect(
            service.performMatch({ lost_place: '不存在的地點' })
        ).rejects.toBeDefined();

        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'error' });
    });
});
