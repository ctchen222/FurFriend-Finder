jest.mock('../../../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
    matchLogger: { http: jest.fn() },
}));

const mockMatchRequestCounterAdd = jest.fn();
const mockMatchDurationRecord = jest.fn();
const mockMatchCandidatesRecord = jest.fn();
const mockMatchResultsRecord = jest.fn();
const mockMatchNoResultAdd = jest.fn();
const mockUniqueShelterRecord = jest.fn();
const mockFailedShelterAdd = jest.fn();
const mockRecordMatchRequest = jest.fn(
    async (boundary: string, work: () => Promise<unknown>) => {
        try {
            const result = await work();
            mockMatchRequestCounterAdd(1, { status: 'success' });
            return result;
        } catch (error) {
            mockMatchRequestCounterAdd(1, { status: 'error' });
            throw error;
        } finally {
            mockMatchDurationRecord(0, { boundary });
        }
    },
);

jest.mock('../../../config/metrics', () => ({
    matchRequestCounter: { add: mockMatchRequestCounterAdd },
    matchDurationHistogram: { record: mockMatchDurationRecord },
    matchCandidatesHistogram: { record: mockMatchCandidatesRecord },
    matchResultsHistogram: { record: mockMatchResultsRecord },
    matchNoResultCounter: { add: mockMatchNoResultAdd },
    geocodingUniqueShelterAddressesHistogram: { record: mockUniqueShelterRecord },
    geocodingFailedShelterCounter: { add: mockFailedShelterAdd },
    recordMatchRequest: (...args: unknown[]) => mockRecordMatchRequest(...args),
    safeMetricAttributes: (attributes: Record<string, unknown>) => attributes,
    registerDbPoolGauge: jest.fn(),
}));

import MatchingService from '../../../Service/matching';
import GeoService from '../../../Service/geo';
import {
    matchCandidatesHistogram,
    matchDurationHistogram,
    matchNoResultCounter,
    matchRequestCounter,
    matchResultsHistogram,
} from '../../../config/metrics';

const mockAdd = matchRequestCounter.add as jest.Mock;
const mockDurationRecord = matchDurationHistogram.record as jest.Mock;
const mockCandidatesRecord = matchCandidatesHistogram.record as jest.Mock;
const mockResultsRecord = matchResultsHistogram.record as jest.Mock;
const mockNoResultAdd = matchNoResultCounter.add as jest.Mock;

describe('MatchingService — matchRequestCounter', () => {
    let service: MatchingService;
    let mockFindMatchingAnimals: jest.Mock;
    let mockGeocoding: jest.Mock;

    beforeEach(() => {
        mockFindMatchingAnimals = jest.fn();
        mockGeocoding = jest.fn();
        mockAdd.mockClear();
        mockDurationRecord.mockClear();
        mockCandidatesRecord.mockClear();
        mockResultsRecord.mockClear();
        mockNoResultAdd.mockClear();
        mockUniqueShelterRecord.mockClear();
        mockFailedShelterAdd.mockClear();
        mockRecordMatchRequest.mockClear();
        mockRecordMatchRequest.mockImplementation(
            async (boundary: string, work: () => Promise<unknown>) => {
                try {
                    const result = await work();
                    mockMatchRequestCounterAdd(1, { status: 'success' });
                    return result;
                } catch (error) {
                    mockMatchRequestCounterAdd(1, { status: 'error' });
                    throw error;
                } finally {
                    mockMatchDurationRecord(0, { boundary });
                }
            },
        );

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
        expect(mockDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'perform_match' });
        expect(mockCandidatesRecord).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
        expect(mockUniqueShelterRecord).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
        expect(mockResultsRecord).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
    });

    it('should increment matchRequestCounter with status=error when geocoding returns null', async () => {
        mockGeocoding.mockResolvedValue(null);

        await expect(
            service.performMatch({ lost_place: '不存在的地點' })
        ).rejects.toBeDefined();

        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'error' });
        expect(mockDurationRecord).toHaveBeenCalledWith(expect.any(Number), { boundary: 'perform_match' });
    });

    it('should retain all candidates before ranking', async () => {
        mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
        mockFindMatchingAnimals.mockResolvedValue(
            Array.from({ length: 201 }, (_, index) => ({
                id: `a${index}`,
                shelter_address: '台北市動物之家',
            }))
        );

        await service.performMatch({ lost_place: '台北市信義區' });

        expect(mockCandidatesRecord).toHaveBeenCalledWith(201, { boundary: 'perform_match' });
        expect(mockUniqueShelterRecord).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
        expect(mockResultsRecord).toHaveBeenCalledWith(10, { boundary: 'perform_match' });
    });

    it('should record no-result outcomes when matching succeeds with no returned matches', async () => {
        mockGeocoding.mockResolvedValue({ lat: 25.04, lng: 121.51 });
        mockFindMatchingAnimals.mockResolvedValue([]);

        await service.performMatch({ lost_place: '台北市信義區' });

        expect(mockCandidatesRecord).toHaveBeenCalledWith(0, { boundary: 'perform_match' });
        expect(mockResultsRecord).toHaveBeenCalledWith(0, { boundary: 'perform_match' });
        expect(mockNoResultAdd).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
    });

    it('should record shelter geocoding workload and failures during matching', async () => {
        mockGeocoding
            .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 })
            .mockRejectedValueOnce(new Error('API error'))
            .mockResolvedValueOnce({ lat: 25.04, lng: 121.51 });
        mockFindMatchingAnimals.mockResolvedValue([
            { id: 'a1', shelter_address: '台中市動物之家' },
            { id: 'a2', shelter_address: '台北市動物之家' },
        ]);

        await service.performMatch({ lost_place: '台北市信義區' });

        expect(mockUniqueShelterRecord).toHaveBeenCalledWith(2, { boundary: 'perform_match' });
        expect(mockFailedShelterAdd).toHaveBeenCalledWith(1, { boundary: 'perform_match' });
    });
});
