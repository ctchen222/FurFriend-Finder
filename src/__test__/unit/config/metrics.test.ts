const mockAddCallback = jest.fn();
const mockGauges: Record<string, { addCallback: jest.Mock }> = {};
const mockCounters: Record<string, { add: jest.Mock }> = {};
const mockHistograms: Record<string, { record: jest.Mock }> = {};
const registeredMeters: string[] = [];
const registeredCounters: string[] = [];
const registeredHistograms: string[] = [];
const registeredGauges: string[] = [];
const registeredGaugeCallbacks: Record<string, Array<(observable: { observe: jest.Mock }) => void>> = {};
const getMockCounter = (name: string) => {
    mockCounters[name] ??= { add: jest.fn() };
    return mockCounters[name];
};
const getMockHistogram = (name: string) => {
    mockHistograms[name] ??= { record: jest.fn() };
    return mockHistograms[name];
};
const getMockGauge = (name: string) => {
    mockGauges[name] ??= {
        addCallback: jest.fn((callback) => {
            if (name === 'db_pool_connections') {
                mockAddCallback(callback);
            }
            registeredGaugeCallbacks[name] ??= [];
            registeredGaugeCallbacks[name].push(callback);
        }),
    };
    return mockGauges[name];
};
const mockMatchCounter = getMockCounter('match_requests_total');
const mockEmailCounter = getMockCounter('email_sends_total');
const mockMeter = {
    createCounter: jest.fn((name: string) => {
        registeredCounters.push(name);
        return getMockCounter(name);
    }),
    createHistogram: jest.fn((name: string) => {
        registeredHistograms.push(name);
        return getMockHistogram(name);
    }),
    createObservableGauge: jest.fn((name: string) => {
        registeredGauges.push(name);
        return getMockGauge(name);
    }),
};
const mockGetMeter = jest.fn((name: string) => {
    registeredMeters.push(name);
    return mockMeter;
});

jest.mock('@opentelemetry/api', () => ({
    metrics: {
        getMeter: mockGetMeter,
    },
}));

jest.mock('../../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

import {
    assertSafeMetricAttributes,
    DB_OPERATIONS,
    EMAIL_FAILURE_REASONS,
    EMAIL_TEMPLATES,
    extractCityCountyMetricLabel,
    GEOCODING_STATUSES,
    initializeBusinessMetricSeries,
    MATCH_BOUNDARIES,
    METRIC_LABEL_KEYS,
    normalizeCityCountyMetricLabel,
    recordAnimalSyncApiRequest,
    recordAnimalSyncRun,
    recordEmailAttempt,
    recordEmailTemplateFailure,
    recordGeocodingRequest,
    recordMatchFlow,
    recordMatchRequest,
    recordMetricDuration,
    recordMetricOutcome,
    registerDbPoolGauge,
    safeMetricAttributes,
    setAnimalSyncLastSuccessTimestamp,
    setLostAnimalInventory,
    setShelterAnimalInventory,
} from '../../../config/metrics';

describe('optimization metric registration', () => {
    it('should use the existing project meter for all metric definitions', () => {
        expect(registeredMeters).toEqual(['furfriend-finder']);
    });

    it('should register optimization counters', () => {
        expect(registeredCounters).toEqual(expect.arrayContaining([
            'match_truncated_total',
            'match_no_result_total',
            'geocoding_requests_total',
            'geocoding_failed_shelter_total',
            'db_query_errors_total',
            'email_failures_total',
            'animal_sync_runs_total',
            'animal_sync_updated_rows_total',
            'animal_sync_api_failures_total',
        ]));
    });

    it('should register optimization histograms', () => {
        expect(registeredHistograms).toEqual(expect.arrayContaining([
            'match_duration_milliseconds',
            'match_candidates_total',
            'match_results_total',
            'geocoding_duration_milliseconds',
            'geocoding_unique_shelter_addresses_total',
            'db_query_duration_milliseconds',
            'email_send_duration_milliseconds',
            'animal_sync_duration_milliseconds',
        ]));
    });

    it('should register observable gauges for sync timestamp and county inventory', () => {
        expect(registeredGauges).toEqual(expect.arrayContaining([
            'animal_sync_last_success_timestamp',
            'shelter_animals_current',
            'lost_animals_current',
        ]));
    });
});

describe('bounded metric labels', () => {
    it('should expose the expected low-cardinality label vocabularies', () => {
        expect(METRIC_LABEL_KEYS).toEqual([
            'status',
            'operation',
            'template',
            'reason',
            'source',
            'table',
            'boundary',
            'city_county',
        ]);
        expect(MATCH_BOUNDARIES).toContain('perform_match');
        expect(MATCH_BOUNDARIES).toContain('match_flow');
        expect(GEOCODING_STATUSES).toContain('over_query_limit');
        expect(DB_OPERATIONS).toContain('find_match_candidates');
        expect(EMAIL_TEMPLATES).toContain('match_notice');
        expect(EMAIL_FAILURE_REASONS).toContain('smtp_rejected');
    });

    it('should normalize Taiwan city/county labels', () => {
        expect(normalizeCityCountyMetricLabel('台北市')).toBe('臺北市');
        expect(normalizeCityCountyMetricLabel('嘉義縣')).toBe('嘉義縣');
        expect(normalizeCityCountyMetricLabel('東京')).toBeNull();
    });

    it('should extract Taiwan city/county labels from addresses', () => {
        expect(extractCityCountyMetricLabel('台北市信義區信義路')).toBe('臺北市');
        expect(extractCityCountyMetricLabel('新竹縣竹北市光明六路')).toBe('新竹縣');
        expect(extractCityCountyMetricLabel('新竹市東區光復路')).toBe('新竹市');
        expect(extractCityCountyMetricLabel('東京都港區')).toBeNull();
    });

    it('should allow only curated metric labels and values', () => {
        expect(() => assertSafeMetricAttributes({
            status: 'success',
            operation: 'find_match_candidates',
            template: 'match_notice',
            reason: 'smtp_rejected',
            source: 'shelter_animals_api',
            table: 'animal',
            boundary: 'perform_match',
            city_county: '臺北市',
        })).not.toThrow();

        expect(safeMetricAttributes({ status: 'error' })).toEqual({ status: 'error' });
    });

    it('should reject raw or unbounded labels', () => {
        expect(() => assertSafeMetricAttributes({ animal_id: '123' })).toThrow(/not allowed/);
        expect(() => assertSafeMetricAttributes({ email: 'owner@example.com' })).toThrow(/not allowed/);
        expect(() => assertSafeMetricAttributes({ address: '臺北市信義區' })).toThrow(/not allowed/);
        expect(() => assertSafeMetricAttributes({ sql: 'select * from owner' })).toThrow(/not allowed/);
        expect(() => assertSafeMetricAttributes({ status: 'GOOGLE SAID SOMETHING NEW' })).toThrow(/unbounded value/);
        expect(() => assertSafeMetricAttributes({ city_county: '東京' })).toThrow(/unbounded value/);
    });
});

describe('business metric counters', () => {
    it('should initialize known match and email status series to zero', () => {
        initializeBusinessMetricSeries();

        expect(mockMatchCounter.add).toHaveBeenCalledWith(0, { status: 'success' });
        expect(mockMatchCounter.add).toHaveBeenCalledWith(0, { status: 'error' });
        expect(mockEmailCounter.add).toHaveBeenCalledWith(0, { status: 'sent', template: 'verification' });
        expect(mockEmailCounter.add).toHaveBeenCalledWith(0, { status: 'failed', template: 'match_notice' });
    });
});

describe('registerDbPoolGauge', () => {
    it('should register a callback with the ObservableGauge', () => {
        const mockPool = { totalCount: 5, idleCount: 3, waitingCount: 1 } as any;
        registerDbPoolGauge(mockPool);
        expect(mockGauges.db_pool_connections.addCallback).toHaveBeenCalledTimes(1);
    });

    it('should observe total, idle, and waiting states from the pool', () => {
        const mockPool = { totalCount: 5, idleCount: 3, waitingCount: 1 } as any;
        registerDbPoolGauge(mockPool);

        const registeredCallback = mockGauges.db_pool_connections.addCallback.mock.calls[0][0];
        const mockObservable = { observe: jest.fn() };
        registeredCallback(mockObservable);

        expect(mockObservable.observe).toHaveBeenCalledWith(5, { state: 'total' });
        expect(mockObservable.observe).toHaveBeenCalledWith(3, { state: 'idle' });
        expect(mockObservable.observe).toHaveBeenCalledWith(1, { state: 'waiting' });
    });
});

describe('observable optimization gauges', () => {
    it('should observe last successful sync timestamps by source', () => {
        setAnimalSyncLastSuccessTimestamp('shelter_animals_api', 123);

        const registeredCallback = registeredGaugeCallbacks.animal_sync_last_success_timestamp[0];
        const mockObservable = { observe: jest.fn() };
        registeredCallback(mockObservable);

        expect(mockObservable.observe).toHaveBeenCalledWith(123, { source: 'shelter_animals_api' });
    });

    it('should observe county inventory with normalized labels', () => {
        setShelterAnimalInventory({ '台北市': 5 });
        setLostAnimalInventory({ '嘉義縣': 2 });

        const shelterCallback = registeredGaugeCallbacks.shelter_animals_current[0];
        const lostCallback = registeredGaugeCallbacks.lost_animals_current[0];
        const mockShelterObservable = { observe: jest.fn() };
        const mockLostObservable = { observe: jest.fn() };

        shelterCallback(mockShelterObservable);
        lostCallback(mockLostObservable);

        expect(mockShelterObservable.observe).toHaveBeenCalledWith(5, { city_county: '臺北市' });
        expect(mockLostObservable.observe).toHaveBeenCalledWith(2, { city_county: '嘉義縣' });
    });

    it('should reject non-Taiwan county inventory labels', () => {
        expect(() => setShelterAnimalInventory({ '東京': 1 })).toThrow(/Invalid Taiwan city\/county/);
    });
});

describe('metric recording wrappers', () => {
    beforeEach(() => {
        for (const counter of Object.values(mockCounters)) {
            counter.add.mockClear();
        }
        for (const histogram of Object.values(mockHistograms)) {
            histogram.record.mockClear();
        }
    });

    it('should record generic duration and rethrow the original error', async () => {
        const histogram = getMockHistogram('generic_duration_test');
        const error = new Error('boom');

        await expect(recordMetricDuration(
            histogram,
            { status: 'success' },
            async () => {
                throw error;
            },
        )).rejects.toBe(error);

        expect(histogram.record).toHaveBeenCalledWith(expect.any(Number), { status: 'success' });
    });

    it('should record generic success and error outcomes without swallowing errors', async () => {
        const counter = getMockCounter('generic_outcome_test');
        const error = new Error('outcome failed');

        await expect(recordMetricOutcome(
            {
                counter,
                successAttributes: { status: 'success' },
                errorAttributes: { status: 'error' },
            },
            async () => 'ok',
        )).resolves.toBe('ok');

        await expect(recordMetricOutcome(
            {
                counter,
                successAttributes: { status: 'success' },
                errorAttributes: { status: 'error' },
            },
            async () => {
                throw error;
            },
        )).rejects.toBe(error);

        expect(counter.add).toHaveBeenCalledWith(1, { status: 'success' });
        expect(counter.add).toHaveBeenCalledWith(1, { status: 'error' });
    });

    it('should record matching wrapper success, error, and match-flow duration semantics', async () => {
        const matchCounter = getMockCounter('match_requests_total');
        const matchDuration = getMockHistogram('match_duration_milliseconds');
        const error = new Error('match failed');

        await expect(recordMatchRequest('perform_match', async () => 'matched')).resolves.toBe('matched');
        await expect(recordMatchRequest('perform_match', async () => {
            throw error;
        })).rejects.toBe(error);
        await expect(recordMatchFlow(async () => 'flow')).resolves.toBe('flow');

        expect(matchCounter.add).toHaveBeenCalledWith(1, { status: 'success' });
        expect(matchCounter.add).toHaveBeenCalledWith(1, { status: 'error' });
        expect(matchDuration.record).toHaveBeenCalledWith(expect.any(Number), { boundary: 'perform_match' });
        expect(matchDuration.record).toHaveBeenCalledWith(expect.any(Number), { boundary: 'match_flow' });
    });

    it('should record geocoding wrapper status and default failed status', async () => {
        const geocodingCounter = getMockCounter('geocoding_requests_total');
        const geocodingDuration = getMockHistogram('geocoding_duration_milliseconds');
        const error = new Error('geocoding failed');

        await expect(recordGeocodingRequest(async (setStatus) => {
            setStatus('zero_results');
            return null;
        })).resolves.toBeNull();

        await expect(recordGeocodingRequest(async () => {
            throw error;
        })).rejects.toBe(error);

        expect(geocodingCounter.add).toHaveBeenCalledWith(1, { status: 'zero_results' });
        expect(geocodingCounter.add).toHaveBeenCalledWith(1, { status: 'error' });
        expect(geocodingDuration.record).toHaveBeenCalledWith(expect.any(Number), { status: 'zero_results' });
        expect(geocodingDuration.record).toHaveBeenCalledWith(expect.any(Number), { status: 'error' });
    });

    it('should record email send attempts and keep template failures separate', async () => {
        const emailSends = getMockCounter('email_sends_total');
        const emailFailures = getMockCounter('email_failures_total');
        const emailDuration = getMockHistogram('email_send_duration_milliseconds');
        const error = new Error('smtp timeout');

        await expect(recordEmailAttempt(
            'verification',
            () => 'unknown',
            async () => 'sent',
        )).resolves.toBe('sent');

        await expect(recordEmailAttempt(
            'reset_password',
            () => 'timeout',
            async () => {
                throw error;
            },
        )).rejects.toBe(error);

        const sendAttemptsBeforeTemplateFailure = emailSends.add.mock.calls.length;
        recordEmailTemplateFailure('match_notice');

        expect(emailSends.add).toHaveBeenCalledWith(1, { status: 'sent', template: 'verification' });
        expect(emailSends.add).toHaveBeenCalledWith(1, { status: 'failed', template: 'reset_password' });
        expect(emailFailures.add).toHaveBeenCalledWith(1, { template: 'reset_password', reason: 'timeout' });
        expect(emailFailures.add).toHaveBeenCalledWith(1, { template: 'match_notice', reason: 'template' });
        expect(emailDuration.record).toHaveBeenCalledWith(expect.any(Number), { template: 'verification' });
        expect(emailDuration.record).toHaveBeenCalledWith(expect.any(Number), { template: 'reset_password' });
        expect(emailSends.add).toHaveBeenCalledTimes(sendAttemptsBeforeTemplateFailure);
    });

    it('should record sync wrapper success, failure, updated rows, and API failures', async () => {
        const syncRuns = getMockCounter('animal_sync_runs_total');
        const syncDuration = getMockHistogram('animal_sync_duration_milliseconds');
        const updatedRows = getMockCounter('animal_sync_updated_rows_total');
        const apiFailures = getMockCounter('animal_sync_api_failures_total');
        const syncError = new Error('sync failed');
        const apiError = new Error('api failed');

        await expect(recordAnimalSyncRun(
            'shelter_animals_api',
            'animal',
            async () => 7,
        )).resolves.toBe(7);

        await expect(recordAnimalSyncRun(
            'lost_animals_api',
            'animal_lost',
            async () => {
                throw syncError;
            },
        )).rejects.toBe(syncError);

        await expect(recordAnimalSyncApiRequest(
            'lost_animals_api',
            async () => {
                throw apiError;
            },
        )).rejects.toBe(apiError);

        const registeredCallback = registeredGaugeCallbacks.animal_sync_last_success_timestamp[0];
        const mockObservable = { observe: jest.fn() };
        registeredCallback(mockObservable);

        expect(updatedRows.add).toHaveBeenCalledWith(7, { table: 'animal' });
        expect(syncRuns.add).toHaveBeenCalledWith(1, { status: 'success', source: 'shelter_animals_api' });
        expect(syncRuns.add).toHaveBeenCalledWith(1, { status: 'error', source: 'lost_animals_api' });
        expect(syncDuration.record).toHaveBeenCalledWith(expect.any(Number), { source: 'shelter_animals_api' });
        expect(syncDuration.record).toHaveBeenCalledWith(expect.any(Number), { source: 'lost_animals_api' });
        expect(apiFailures.add).toHaveBeenCalledWith(1, { source: 'lost_animals_api' });
        expect(mockObservable.observe).toHaveBeenCalledWith(expect.any(Number), { source: 'shelter_animals_api' });
    });
});
