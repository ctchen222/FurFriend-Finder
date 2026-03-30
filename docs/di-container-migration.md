# DI Container Migration Guide

## Current State

All services use **Constructor Injection** with optional `deps` parameters:

```typescript
class MatchingService {
  constructor(deps?: { geoService?: GeoService; repository?: AnimalLostRepository }) {
    this.geoService = deps?.geoService ?? new GeoService();
    this.repository = deps?.repository ?? new AnimalLostRepository();
  }
}
```

This is simple and effective for the current scale (~5 services, 2 levels of nesting).
No framework required.

## Comparison: Three DI Approaches

### 1. Constructor Injection (current)

**How it works:** Pass dependencies explicitly through the constructor. Use `??` defaults
so production code can call `new Service()` without arguments.

**Pros:**
- Zero framework overhead
- Dependencies are explicit and easy to trace
- TypeScript provides full type safety
- Testing is straightforward: pass mocks directly

**Cons:**
- Wiring is manual — at startup you must call `new A(new B(new C()))` by hand
- Gets verbose as nesting depth increases (3+ levels)

**Best for:** Up to ~10 services, at most 3 levels of nesting.

---

### 2. Service Locator (not recommended)

**How it works:** A global registry maps tokens to instances; services call
`container.get(MyService)` internally.

**Pros:**
- Easy to add new services without touching callers

**Cons:**
- Dependencies are hidden — you cannot tell from a class signature what it needs
- Makes testing harder (must pre-populate the registry)
- Creates implicit global state

**Verdict:** Avoid. Constructor injection is strictly better.

---

### 3. DI Container (tsyringe / inversify)

**How it works:** Decorators (`@injectable`, `@inject`) mark classes and their
dependencies. The container resolves the full dependency graph automatically.

**Pros:**
- No manual wiring — `container.resolve(AnimalLostController)` instantiates the
  entire tree automatically
- Lifecycle management (singleton vs transient) is declarative
- Easy to swap implementations for different environments

**Cons:**
- Requires `reflect-metadata` polyfill
- Decorators are a Stage 2 proposal (experimental TypeScript flag required)
- Adds build complexity and a learning curve
- Overkill for small service counts

**Best for:** 20+ services or more than 3 levels of nesting.

---

## When to Migrate to a DI Container

Migrate when you encounter **two or more** of the following:

- More than 20 services
- Constructor calls are nested 4+ levels deep (e.g. `new A(new B(new C(new D())))`)
- You frequently need to swap implementations per environment (test / staging / prod)
- You want request-scoped lifetimes (e.g. per-request DB connections)

## Step-by-Step Migration Path (tsyringe)

If the decision is made to migrate, follow these steps:

**Step 1 — Install dependencies**
```bash
npm install tsyringe reflect-metadata
```

**Step 2 — Enable decorators in `tsconfig.json`**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

**Step 3 — Add `@injectable()` to each service**
```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
class MatchingService {
  constructor(
    @inject(GeoService) private geoService: GeoService,
    @inject(AnimalLostRepository) private repository: AnimalLostRepository
  ) {}
}
```

**Step 4 — Register implementations at startup (`src/index.ts`)**
```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';

container.register(GeoService, { useClass: GeoService });
container.register(AnimalLostRepository, { useClass: AnimalLostRepository });
// ... register all services

const controller = container.resolve(AnimalLostController);
```

**Step 5 — Remove the `deps?` constructor pattern**
Once all services are registered, the manual `??` defaults are no longer needed.
Remove them incrementally, service by service.

**Step 6 — Update tests**
In tests, use `container.registerInstance` to inject mocks:
```typescript
container.registerInstance(GeoService, mockGeoService);
const service = container.resolve(MatchingService);
```

## Recommendation

**Do not migrate now.** The current codebase has ~5 services with at most 2 levels
of nesting. Constructor injection handles this cleanly. Revisit this guide when the
service count exceeds 15 or nesting becomes a pain point.
