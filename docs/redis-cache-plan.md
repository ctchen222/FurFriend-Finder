# Redis Cache Plan: Geocoding Results

## Problem

`MatchingService.geocodeAndCalculateDistances` calls the Google Maps Geocoding API
for every unique `shelter_address` on each `performMatch` invocation. Taiwan has
roughly **30 unique shelter addresses** across all animal shelters — these addresses
rarely change, yet they are re-geocoded on every request.

Current cost per `performMatch` call: 1 (lost\_place) + up to 30 (shelter addresses)
= **up to 31 API calls**.

## Proposed Solution

Cache `shelter_address → { lat, lng }` results in Redis with a **7-day TTL**.

- Shelter addresses change at most a few times per year (new shelters opening,
  address corrections by the government).
- A 7-day TTL means stale coordinates are corrected automatically within a week
  without requiring a cache invalidation strategy.
- Expected steady-state cost per `performMatch`: **1 API call** (lost\_place only,
  since shelter coords are cached).

## Implementation Sketch

```typescript
// src/libs/geocodingCache.ts
import Redis from 'ioredis';

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class GeocodingCache {
  constructor(private redis: Redis) {}

  async get(address: string): Promise<{ lat: number; lng: number } | null | undefined> {
    const raw = await this.redis.get(`geocode:${address}`);
    if (raw === null) return undefined;           // cache miss
    if (raw === 'null') return null;              // ZERO_RESULTS cached
    return JSON.parse(raw);
  }

  async set(address: string, coords: { lat: number; lng: number } | null): Promise<void> {
    await this.redis.set(
      `geocode:${address}`,
      coords === null ? 'null' : JSON.stringify(coords),
      'EX',
      CACHE_TTL_SECONDS
    );
  }
}
```

```typescript
// Integration into GeoService (or MatchingService)
async geocodingWithCache(address: string): Promise<{ lat: number; lng: number } | null> {
  const cached = await this.cache.get(address);
  if (cached !== undefined) return cached;       // cache hit (including ZERO_RESULTS)

  const result = await this.geoService.geocoding(address);
  await this.cache.set(address, result);
  return result;
}
```

## Dependencies

```bash
npm install ioredis
npm install --save-dev @types/ioredis  # if not bundled
```

## When to Implement

Implement when any of the following applies:

- Production traffic shows geocoding API costs becoming significant
- Rate limiting or quota errors appear in logs
- `performMatch` latency is measurably impacted by geocoding round-trips

## What NOT to Cache

- `lost_place` coordinates — these are user-specific one-time lookups and should
  not be cached (privacy concern + rarely repeated).

## Notes

- Redis connection should be injected into `MatchingService` via constructor injection
  (consistent with the existing DI pattern in this codebase).
- For local development without Redis, replace with a simple in-process `Map` that
  acts as an LRU cache — the interface above makes this easy to swap.
