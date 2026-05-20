import { metrics, type Attributes } from '@opentelemetry/api';
import type { Pool } from 'pg';
import {
    normalizeTaiwanCityCounty,
    taiwanCities,
} from '../libs/taiwanCities.utils';
import logger from './logger';

const meter = metrics.getMeter('furfriend-finder');

export const MATCH_STATUSES = ['success', 'error'] as const;
export const EMAIL_STATUSES = ['sent', 'failed'] as const;
export const GEOCODING_STATUSES = [
    'ok',
    'zero_results',
    'over_query_limit',
    'request_denied',
    'error',
] as const;
export const ANIMAL_SYNC_STATUSES = ['success', 'error'] as const;
export const MATCH_BOUNDARIES = ['perform_match', 'match_flow'] as const;
export const EMAIL_TEMPLATES = [
    'verification',
    'reset_password',
    'match_notice',
    'generic',
] as const;
export const EMAIL_FAILURE_REASONS = [
    'smtp_rejected',
    'auth',
    'timeout',
    'network',
    'template',
    'unknown',
] as const;
export const ANIMAL_SYNC_TABLES = ['animal', 'animal_lost'] as const;
export const ANIMAL_SYNC_SOURCES = [
    'shelter_animals_api',
    'lost_animals_api',
] as const;
export const DB_OPERATIONS = [
    'find_match_candidates',
    'find_shelter_animals',
    'find_lost_animal',
    'find_owner',
    'bulk_insert_animals',
    'bulk_insert_lost_animals',
] as const;

export const METRIC_LABEL_KEYS = [
    'status',
    'operation',
    'template',
    'reason',
    'source',
    'table',
    'boundary',
    'city_county',
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
export type GeocodingStatus = (typeof GEOCODING_STATUSES)[number];
export type AnimalSyncStatus = (typeof ANIMAL_SYNC_STATUSES)[number];
export type MatchBoundary = (typeof MATCH_BOUNDARIES)[number];
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];
export type EmailFailureReason = (typeof EMAIL_FAILURE_REASONS)[number];
export type AnimalSyncTable = (typeof ANIMAL_SYNC_TABLES)[number];
export type AnimalSyncSource = (typeof ANIMAL_SYNC_SOURCES)[number];
export type DbOperation = (typeof DB_OPERATIONS)[number];
export type MetricLabelKey = (typeof METRIC_LABEL_KEYS)[number];
export type SafeMetricAttributes = Partial<
    Record<MetricLabelKey, string | number | boolean>
>;
export type CountyInventoryCounts = Record<string, number>;

type MetricCounter = {
    add(value: number, attributes?: Attributes): void;
};

type MetricHistogram = {
    record(value: number, attributes?: Attributes): void;
};

type AsyncMetricWork<T> = () => Promise<T>;

const allowedLabelKeys = new Set<string>(METRIC_LABEL_KEYS);
const disallowedLabelKeys = new Set([
    'address',
    'shelter_address',
    'lost_place',
    'lat',
    'lng',
    'latitude',
    'longitude',
    'email',
    'user_id',
    'userId',
    'owner_id',
    'ownerId',
    'animal_id',
    'animalId',
    'sql',
    'db_statement',
    'url',
    'exception',
    'exception_message',
    'message',
]);

const allowedValuesByLabel: Record<
    Exclude<MetricLabelKey, 'city_county'>,
    Set<string>
> = {
    status: new Set([
        ...MATCH_STATUSES,
        ...EMAIL_STATUSES,
        ...GEOCODING_STATUSES,
        ...ANIMAL_SYNC_STATUSES,
    ]),
    operation: new Set(DB_OPERATIONS),
    template: new Set(EMAIL_TEMPLATES),
    reason: new Set(EMAIL_FAILURE_REASONS),
    source: new Set(ANIMAL_SYNC_SOURCES),
    table: new Set(ANIMAL_SYNC_TABLES),
    boundary: new Set(MATCH_BOUNDARIES),
};

function isAllowedMetricValue(
    key: MetricLabelKey,
    value: string | number | boolean,
): boolean {
    if (typeof value !== 'string') {
        return true;
    }

    if (key === 'city_county') {
        return normalizeCityCountyMetricLabel(value) === value;
    }

    return allowedValuesByLabel[key].has(value);
}

export function normalizeCityCountyMetricLabel(value: string): string | null {
    return normalizeTaiwanCityCounty(value);
}

export function extractCityCountyMetricLabel(value: string): string | null {
    const normalized = value.trim().replace(/台/g, '臺');

    const exact = normalizeCityCountyMetricLabel(normalized);
    if (exact !== null) {
        return exact;
    }

    const cityCountyBySpecificity = [...taiwanCities].sort(
        (left, right) => right.length - left.length,
    );
    for (const cityCounty of cityCountyBySpecificity) {
        if (normalized.includes(cityCounty)) {
            return cityCounty;
        }
    }

    return null;
}

export function assertSafeMetricAttributes(
    attributes: Record<string, unknown>,
): asserts attributes is SafeMetricAttributes {
    for (const [key, value] of Object.entries(attributes)) {
        if (disallowedLabelKeys.has(key) || !allowedLabelKeys.has(key)) {
            throw new Error(`Metric label "${key}" is not allowed`);
        }

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean'
        ) {
            throw new Error(
                `Metric label "${key}" must be a string, number, or boolean`,
            );
        }

        if (!isAllowedMetricValue(key as MetricLabelKey, value)) {
            throw new Error(`Metric label "${key}" has an unbounded value`);
        }
    }
}

export function safeMetricAttributes(
    attributes: SafeMetricAttributes = {},
): Attributes {
    assertSafeMetricAttributes(attributes);
    return attributes as Attributes;
}

export const matchRequestCounter = meter.createCounter('match_requests_total', {
    description: 'Total match requests',
});

export const emailCounter = meter.createCounter('email_sends_total', {
    description: 'Email send attempts by status',
});

export const matchDurationHistogram = meter.createHistogram(
    'match_duration_milliseconds',
    {
        description: 'Matching duration by measured boundary',
        unit: 'ms',
    },
);

export const matchCandidatesHistogram = meter.createHistogram(
    'match_candidates_total',
    {
        description: 'Candidate count before geocoding truncation',
        unit: '1',
    },
);

export const matchResultsHistogram = meter.createHistogram(
    'match_results_total',
    {
        description: 'Returned match result count',
        unit: '1',
    },
);

export const matchTruncatedCounter = meter.createCounter(
    'match_truncated_total',
    {
        description: 'Total match requests truncated by geocoding batch limit',
    },
);

export const matchNoResultCounter = meter.createCounter(
    'match_no_result_total',
    {
        description: 'Total successful match requests returning zero results',
    },
);

export const geocodingRequestCounter = meter.createCounter(
    'geocoding_requests_total',
    {
        description: 'Geocoding requests by bounded status',
    },
);

export const geocodingDurationHistogram = meter.createHistogram(
    'geocoding_duration_milliseconds',
    {
        description: 'Geocoding request duration by bounded status',
        unit: 'ms',
    },
);

export const geocodingUniqueShelterAddressesHistogram = meter.createHistogram(
    'geocoding_unique_shelter_addresses_total',
    {
        description: 'Deduplicated shelter-address geocoding workload size',
        unit: '1',
    },
);

export const geocodingFailedShelterCounter = meter.createCounter(
    'geocoding_failed_shelter_total',
    {
        description: 'Shelter-address geocoding failures during matching',
    },
);

export const dbQueryDurationHistogram = meter.createHistogram(
    'db_query_duration_milliseconds',
    {
        description: 'Core database operation duration by curated operation',
        unit: 'ms',
    },
);

export const dbQueryErrorsCounter = meter.createCounter(
    'db_query_errors_total',
    {
        description: 'Core database operation failures by curated operation',
    },
);

export async function recordMetricDuration<T>(
    histogram: MetricHistogram,
    attributes: SafeMetricAttributes,
    work: AsyncMetricWork<T>,
): Promise<T> {
    const startedAt = Date.now();
    const safeAttributes = safeMetricAttributes(attributes);

    try {
        return await work();
    } finally {
        histogram.record(Date.now() - startedAt, safeAttributes);
    }
}

export async function recordMetricOutcome<T>(
    options: {
        counter: MetricCounter;
        successAttributes?: SafeMetricAttributes;
        errorAttributes?: SafeMetricAttributes;
    },
    work: AsyncMetricWork<T>,
): Promise<T> {
    try {
        const result = await work();
        if (options.successAttributes) {
            options.counter.add(
                1,
                safeMetricAttributes(options.successAttributes),
            );
        }
        return result;
    } catch (error) {
        if (options.errorAttributes) {
            options.counter.add(
                1,
                safeMetricAttributes(options.errorAttributes),
            );
        }
        throw error;
    }
}

export async function recordDbOperation<T>(
    operation: DbOperation,
    work: () => Promise<T>,
): Promise<T> {
    return recordMetricDuration(
        dbQueryDurationHistogram,
        { operation },
        () => recordMetricOutcome(
            {
                counter: dbQueryErrorsCounter,
                errorAttributes: { operation },
            },
            work,
        ),
    );
}

export const emailSendDurationHistogram = meter.createHistogram(
    'email_send_duration_milliseconds',
    {
        description: 'Email send duration by template',
        unit: 'ms',
    },
);

export const emailFailuresCounter = meter.createCounter(
    'email_failures_total',
    {
        description: 'Email send failures by template and classified reason',
    },
);

export async function recordMatchRequest<T>(
    boundary: Extract<MatchBoundary, 'perform_match'>,
    work: AsyncMetricWork<T>,
): Promise<T> {
    return recordMetricDuration(
        matchDurationHistogram,
        { boundary },
        () => recordMetricOutcome(
            {
                counter: matchRequestCounter,
                successAttributes: { status: 'success' },
                errorAttributes: { status: 'error' },
            },
            work,
        ),
    );
}

export async function recordMatchFlow<T>(
    work: AsyncMetricWork<T>,
): Promise<T> {
    return recordMetricDuration(
        matchDurationHistogram,
        { boundary: 'match_flow' },
        work,
    );
}

export async function recordGeocodingRequest<T>(
    work: (
        setStatus: (status: GeocodingStatus) => void,
    ) => Promise<T>,
): Promise<T> {
    const startedAt = Date.now();
    let status: GeocodingStatus = 'error';

    try {
        return await work((nextStatus) => {
            status = nextStatus;
        });
    } finally {
        const attributes = safeMetricAttributes({ status });
        geocodingRequestCounter.add(1, attributes);
        geocodingDurationHistogram.record(Date.now() - startedAt, attributes);
    }
}

export async function recordEmailAttempt<T>(
    template: EmailTemplate,
    classifyFailureReason: (error: unknown) => EmailFailureReason,
    work: AsyncMetricWork<T>,
): Promise<T> {
    const startedAt = Date.now();
    const templateAttributes = safeMetricAttributes({ template });

    try {
        const result = await work();
        emailCounter.add(
            1,
            safeMetricAttributes({ status: 'sent', template }),
        );
        return result;
    } catch (error) {
        emailCounter.add(
            1,
            safeMetricAttributes({ status: 'failed', template }),
        );
        emailFailuresCounter.add(
            1,
            safeMetricAttributes({
                template,
                reason: classifyFailureReason(error),
            }),
        );
        throw error;
    } finally {
        emailSendDurationHistogram.record(
            Date.now() - startedAt,
            templateAttributes,
        );
    }
}

export function recordEmailTemplateFailure(template: EmailTemplate): void {
    emailFailuresCounter.add(
        1,
        safeMetricAttributes({ template, reason: 'template' }),
    );
}

export const animalSyncRunsCounter = meter.createCounter(
    'animal_sync_runs_total',
    {
        description: 'Animal data sync runs by bounded status',
    },
);

export const animalSyncDurationHistogram = meter.createHistogram(
    'animal_sync_duration_milliseconds',
    {
        description: 'Animal data sync duration',
        unit: 'ms',
    },
);

export const animalSyncUpdatedRowsCounter = meter.createCounter(
    'animal_sync_updated_rows_total',
    {
        description: 'Rows updated by animal data sync',
    },
);

export const animalSyncApiFailuresCounter = meter.createCounter(
    'animal_sync_api_failures_total',
    {
        description: 'Public-data API failures during animal sync',
    },
);

export async function recordAnimalSyncRun<T extends number>(
    source: AnimalSyncSource,
    table: AnimalSyncTable,
    work: AsyncMetricWork<T>,
): Promise<T> {
    const startedAt = Date.now();
    let status: AnimalSyncStatus = 'error';

    try {
        const updatedRows = await work();
        animalSyncUpdatedRowsCounter.add(
            updatedRows,
            safeMetricAttributes({ table }),
        );
        setAnimalSyncLastSuccessTimestamp(source);
        status = 'success';
        return updatedRows;
    } finally {
        animalSyncRunsCounter.add(
            1,
            safeMetricAttributes({ status, source }),
        );
        animalSyncDurationHistogram.record(
            Date.now() - startedAt,
            safeMetricAttributes({ source }),
        );
    }
}

export async function recordAnimalSyncApiRequest<T>(
    source: AnimalSyncSource,
    work: AsyncMetricWork<T>,
): Promise<T> {
    try {
        return await work();
    } catch (error) {
        animalSyncApiFailuresCounter.add(
            1,
            safeMetricAttributes({ source }),
        );
        throw error;
    }
}

const animalSyncLastSuccessTimestampGauge = meter.createObservableGauge(
    'animal_sync_last_success_timestamp',
    {
        description: 'Unix timestamp for the last successful animal data sync',
        unit: 's',
    },
);

const shelterAnimalInventoryGauge = meter.createObservableGauge(
    'shelter_animals_current',
    {
        description:
            'Current shelter-animal inventory by normalized Taiwan city/county',
    },
);

const lostAnimalInventoryGauge = meter.createObservableGauge(
    'lost_animals_current',
    {
        description:
            'Current lost-animal inventory by normalized Taiwan city/county',
    },
);

const animalSyncLastSuccessTimestamps = new Map<AnimalSyncSource, number>();
const shelterAnimalInventory = new Map<string, number>();
const lostAnimalInventory = new Map<string, number>();

export function initializeBusinessMetricSeries(): void {
    for (const status of MATCH_STATUSES) {
        matchRequestCounter.add(0, safeMetricAttributes({ status }));
    }

    for (const status of EMAIL_STATUSES) {
        for (const template of EMAIL_TEMPLATES) {
            emailCounter.add(0, safeMetricAttributes({ status, template }));
        }
    }
}

initializeBusinessMetricSeries();

const dbPoolGauge = meter.createObservableGauge('db_pool_connections', {
    description: 'PostgreSQL connection pool status',
});

export function registerDbPoolGauge(pool: Pool): void {
    dbPoolGauge.addCallback((observable) => {
        try {
            observable.observe(pool.totalCount, { state: 'total' });
            observable.observe(pool.idleCount, { state: 'idle' });
            observable.observe(pool.waitingCount, { state: 'waiting' });
        } catch (err) {
            logger.error('db_pool_connections gauge callback failed', { err });
        }
    });
}

animalSyncLastSuccessTimestampGauge.addCallback((observable) => {
    for (const [
        source,
        timestamp,
    ] of animalSyncLastSuccessTimestamps.entries()) {
        observable.observe(timestamp, safeMetricAttributes({ source }));
    }
});

shelterAnimalInventoryGauge.addCallback((observable) => {
    for (const [cityCounty, count] of shelterAnimalInventory.entries()) {
        observable.observe(
            count,
            safeMetricAttributes({ city_county: cityCounty }),
        );
    }
});

lostAnimalInventoryGauge.addCallback((observable) => {
    for (const [cityCounty, count] of lostAnimalInventory.entries()) {
        observable.observe(
            count,
            safeMetricAttributes({ city_county: cityCounty }),
        );
    }
});

export function setAnimalSyncLastSuccessTimestamp(
    source: AnimalSyncSource,
    timestampSeconds = Date.now() / 1000,
): void {
    animalSyncLastSuccessTimestamps.set(source, timestampSeconds);
}

function replaceCountyInventory(
    target: Map<string, number>,
    counts: CountyInventoryCounts,
): void {
    target.clear();

    for (const [rawCityCounty, count] of Object.entries(counts)) {
        const cityCounty = normalizeCityCountyMetricLabel(rawCityCounty);
        if (cityCounty === null) {
            throw new Error(
                `Invalid Taiwan city/county metric label "${rawCityCounty}"`,
            );
        }

        target.set(cityCounty, count);
    }
}

export function setShelterAnimalInventory(counts: CountyInventoryCounts): void {
    replaceCountyInventory(shelterAnimalInventory, counts);
}

export function setLostAnimalInventory(counts: CountyInventoryCounts): void {
    replaceCountyInventory(lostAnimalInventory, counts);
}
