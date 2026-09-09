# Phase C Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 Phase C 已知的 transaction、mail、worker lease 與資源界線問題，不擴張到 C2.3。

**Architecture:** 以既有 PostgreSQL row locks、claim token fencing 與 transaction outbox 為基礎；不引入外部 queue。生命週期先保證 commit，寄信入口共用 durable cooldown，所有慢 worker 共用 renewable lease，圖片處理採 fail-fast process semaphore 並以資料庫鎖保證 quota。

**Tech Stack:** Node.js 22、TypeScript、Express、PostgreSQL、Jest、Playwright、Sharp、pnpm。

## Global Constraints

- 工作分支固定為 `fix/260909-phase-c-stabilization`，基於 `origin/dev@bae49aa`；PR 只對 `dev`，不直接 push `dev/main`，不自動 merge。
- 不修改主工作目錄的 dirty files；所有實作只在隔離 worktree。
- Invitation 有效七天；ownership transfer 有效二十四小時；mail cooldown 固定六十秒。
- Worker lease 固定 120 秒，每 30 秒續租；SMTP 語意維持 at-least-once，不宣稱 exactly-once。
- 預設 limits：每人 5 組織、每組織 500 動物、每組織 1073741824 圖片 bytes、每 process 2 個圖片處理 permit。
- 不改政府匯入、matching 排名、C2.3 搜尋、C3 認養、OAuth 或 UI 視覺設計。
- V13 timestamp migration 前先停止 worker；legacy `RUNNING` claim reset 為 `PENDING` 並清除 claim token／lease。歷史 `sent_at` 是 wall-time reference data，不保證精確 instant；SMTP 維持 at-least-once。
- 圖片 limiter 只在單一 API process 內生效；組織／動物／照片 quotas 為可設定環境變數並有安全預設。
- 每一 task 必須 RED→GREEN、focused verification、atomic commit；完成前跑完整 gates。

---

### Task 1: Commit expired state and enforce one mail cooldown

**Files:**
- Modify: `src/Service/organizations/membershipService.ts`
- Modify: `src/Service/organizations/membershipRepository.ts`
- Modify: `src/Service/mail.ts`
- Test: `src/__test__/unit/service/mail.service.test.ts`
- Test: `src/scripts/verify-organizations.ts`

**Interfaces:**
- Produces: `mailCooldownAvailable(organizationId, kind, recipient): Promise<boolean>` where recipient is normalized Email for invitation and target user ID for transfer.
- Preserves: public service response and existing domain error codes.

- [ ] **Step 1: Add the expired-state PostgreSQL regression**

Extend the isolated verifier so an expired pending invitation/transfer is exercised through `respondInvitation`/`respondTransfer`, the call rejects with the existing unavailable error, and a direct verification query observes `status='EXPIRED'` after the rejection.

- [ ] **Step 2: Run the verifier and observe RED**

Run: `pnpm exec tsx src/scripts/verify-organizations.ts`

Expected: the service rejects, but the verification query still sees `PENDING` because the update was rolled back.

- [ ] **Step 3: Commit before throwing outside the transaction**

Use a nullable transaction result:

```ts
const result = await withTransaction(db, async (client) => {
    // ...load and validate token...
    if (new Date(row.expires_at) <= new Date()) {
        await repository.invitationStatus(id, 'EXPIRED');
        return null;
    }
    return { organizationId: row.organization_id };
});
if (!result) throw unavailable();
return result;
```

Apply the same structure to transfer using `transferStatus` and `transferUnavailable`.

- [ ] **Step 4: Verify expired state GREEN**

Run: `pnpm exec tsx src/scripts/verify-organizations.ts`

Expected: both calls reject externally and both database rows persist `EXPIRED`.

- [ ] **Step 5: Add mail-copy and cooldown RED tests**

Add a MailService assertion that captures transporter options and requires ownership-transfer text to contain `24 小時後失效` and not `7 天後失效`.

Extend the PostgreSQL verifier with `invite → immediate invite`, `invite → immediate resend`, and `transfer → immediate transfer`. Each second request must reject with status 429, preserve the first pending token, and leave outbox/audit counts unchanged.

- [ ] **Step 6: Implement one durable cooldown**

Add repository queries that check the latest matching outbox `created_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds'`. Call them from create and resend paths before revoking existing rows. Use code `INVITATION_RESEND_COOLDOWN` for invitation and `OWNERSHIP_TRANSFER_COOLDOWN` for transfer, both with HTTP 429.

Update `sendOwnershipTransfer()` to say `連結將於 24 小時後失效。`.

- [ ] **Step 7: Verify and commit Task 1**

Run:

```bash
pnpm exec jest --runInBand src/__test__/unit/service/mail.service.test.ts --testPathIgnorePatterns='/node_modules/|/dist/|e2e'
pnpm exec tsx src/scripts/verify-organizations.ts
pnpm type-check
```

Expected: all commands exit 0.

Commit: `fix: preserve organization expiry and mail cooldown`

---

### Task 2: Renew every externally active worker lease

**Files:**
- Create: `src/workers/leaseRenewal.ts`
- Modify: `src/repository/matchJob.db.ts`
- Modify: `src/repository/notification.db.ts`
- Modify: `src/repository/organizationMail.db.ts`
- Modify: `src/workers/matchWorker.ts`
- Modify: `src/workers/mailWorker.ts`
- Modify: `src/workers/organizationMailWorker.ts`
- Modify: `src/Service/geo.ts`
- Test: `src/__test__/unit/worker/matchWorker.test.ts`
- Test: `src/__test__/unit/worker/mailWorker.test.ts`
- Test: `src/__test__/unit/worker/organizationMailWorker.test.ts`
- Test: `src/__test__/unit/service/geo.service.test.ts`
- Test: `src/scripts/verify-organization-review.ts`

**Interfaces:**
- Produces: repository `renew(id: string, claimToken: string): Promise<boolean>`.
- Produces: `startLeaseRenewal(renew, context, intervalMs = 30_000): { stop(): void }`.

- [ ] **Step 1: Add one slow-worker renewal RED test**

Use Jest fake timers and a deferred external operation. Advance 30 seconds and require the injected repository `renew(id, claimToken)` to be called before resolving the operation.

- [ ] **Step 2: Run the focused test and observe RED**

Run: `pnpm exec jest --runInBand src/__test__/unit/worker/mailWorker.test.ts --testPathIgnorePatterns='/node_modules/|/dist/|e2e'`

Expected: `renew` is never called.

- [ ] **Step 3: Add fenced repository renewal and shared lifecycle**

Each renewal query must use:

```sql
UPDATE <outbox>
SET lease_until = CURRENT_TIMESTAMP + INTERVAL '120 seconds'
WHERE id=$1
  AND state='RUNNING'
  AND claim_token=$2::uuid
  AND lease_until>CURRENT_TIMESTAMP
RETURNING id
```

`startLeaseRenewal` prevents overlapping renew calls, catches and logs a bounded job identifier, and clears its interval in `stop()`.

- [ ] **Step 4: Apply renewal to mail, organization-mail, and match workers**

Start renewal only after a valid claim. Stop it in `finally` around candidate loading, SMTP/geocoding, transaction finalization and failure acknowledgement. Disabled/cancelled fast paths do not need a timer.

- [ ] **Step 5: Add remaining worker and stale-claim tests**

Add fake-timer tests for all three workers. Extend isolated PostgreSQL verification to prove an unexpired renewed claim cannot be reclaimed, an expired non-renewed claim can be reclaimed, and the stale token cannot finish the new claim.

- [ ] **Step 6: Bound geocoding requests**

Pass `timeout: 10_000` to the Google Maps client request and assert it in `geo.service.test.ts`.

- [ ] **Step 7: Verify and commit Task 2**

Run:

```bash
pnpm exec jest --runInBand src/__test__/unit/worker src/__test__/unit/service/geo.service.test.ts --testPathIgnorePatterns='/node_modules/|/dist/|e2e'
pnpm exec tsx src/scripts/verify-organization-review.ts
pnpm type-check
```

Expected: all commands exit 0.

Commit: `fix: renew leases for long-running workers`

---

### Task 3: Bound organization and image resources

**Files:**
- Create: `src/config/organizationLimits.ts`
- Create: `src/Service/organizations/photoWorkLimiter.ts`
- Modify: `src/Service/organizations/repository.ts`
- Modify: `src/Service/organizations/service.ts`
- Modify: `src/Service/organizations/animalRepository.ts`
- Modify: `src/Service/organizations/animalService.ts`
- Modify: `.env.example`
- Test: `src/__test__/unit/config/organizationLimits.test.ts`
- Test: `src/__test__/unit/service/organizationAnimalPhoto.test.ts`
- Test: `src/scripts/verify-organizations.ts`
- Test: `src/scripts/verify-organization-animals.ts`

**Interfaces:**
- Produces: `getOrganizationLimits(env = process.env): OrganizationLimits` with four strict positive integer values.
- Produces: `PhotoWorkLimiter.tryAcquire(): (() => void) | null` with idempotent release.
- Extends service factories with optional limits/limiter injection for deterministic tests.

- [ ] **Step 1: Add strict config and semaphore RED tests**

Assert defaults `5/500/1073741824/2`, accept explicit positive integers, and reject zero, negative, decimals, whitespace or suffixes. Acquire two default permits, require the third to return null, release one, then require a new acquire to succeed; double release must not increase capacity.

- [ ] **Step 2: Run focused tests and observe RED**

Run: `pnpm exec jest --runInBand src/__test__/unit/config/organizationLimits.test.ts src/__test__/unit/service/organizationAnimalPhoto.test.ts --testPathIgnorePatterns='/node_modules/|/dist/|e2e'`

Expected: modules do not exist.

- [ ] **Step 3: Implement strict limits and fail-fast limiter**

Parse with `/^[1-9][0-9]*$/`, `Number.isSafeInteger`, and per-field maximum guards. `tryAcquire` increments only below capacity and returns an idempotent closure that decrements once.

- [ ] **Step 4: Add real PostgreSQL quota RED tests**

Verify organization creation over five, animal creation over 500 using an injected lower test limit, and photo storage exceeding an injected byte limit. Add concurrent attempts at the last available slot and require exactly one success. Verify a replayed requestId returns its original row even after the quota is full.

- [ ] **Step 5: Enforce quotas under existing row locks**

Lock the creator account before counting organizations. For animal creation, check request-id replay before enforcing count. For photo upload, acquire the process permit before Sharp, release in `finally`, then under the organization transaction lock compare current `SUM(octet_length(image)) + normalized.length` with the configured limit.

Use errors:

```ts
new OrganizationError(422, 'ORGANIZATION_LIMIT', '你建立的中途之家已達上限')
new OrganizationError(422, 'ANIMAL_LIMIT', '此中途之家的動物資料已達上限')
new OrganizationError(422, 'ORGANIZATION_PHOTO_QUOTA', '此中途之家的照片容量已達上限')
new OrganizationError(429, 'PHOTO_PROCESSING_BUSY', '照片處理忙碌中，請稍後再試')
```

- [ ] **Step 6: Document configuration and verify Task 3**

Add the four variables and defaults to `.env.example` without real credentials.

Run:

```bash
pnpm exec jest --runInBand src/__test__/unit/config/organizationLimits.test.ts src/__test__/unit/service/organizationAnimalPhoto.test.ts --testPathIgnorePatterns='/node_modules/|/dist/|e2e'
pnpm exec tsx src/scripts/verify-organizations.ts
pnpm verify:organization-animals
pnpm type-check
```

Expected: all commands exit 0.

Commit: `fix: bound organization and photo resources`

---

### Task 4: Full H0 regression gate

**Files:**
- Modify: `docs/organization-animals-c2-acceptance.md`
- Modify: `docs/foster-organization-membership-acceptance.md`

**Interfaces:**
- Consumes all behavior from Tasks 1–3.
- Produces only evidence and updated acceptance documentation.

- [ ] **Step 1: Run complete backend gates**

```bash
pnpm exec jest --runInBand --roots src --testPathIgnorePatterns='/node_modules/|/dist/|e2e'
pnpm type-check
pnpm lint
pnpm build
pnpm build:web
```

Expected: 0 failed suites, commands exit 0.

- [ ] **Step 2: Run real-data and browser gates**

```bash
pnpm exec tsx src/scripts/verify-organizations.ts
pnpm verify:organization-review
pnpm verify:organization-animals
pnpm test:c2:e2e
```

Expected: isolated schemas are removed, all verifier assertions and Playwright scenarios pass.

- [ ] **Step 3: Update acceptance evidence**

Record exact commands, suite/test counts, and explicit limitations: SMTP acceptance is not inbox delivery; worker delivery is at-least-once; process limiter is per API process; quotas are configurable. Record the V13 recovery prerequisite: stop workers before migration, reset legacy `RUNNING` claims to `PENDING`, and treat historical `sent_at` as non-instant wall-time reference data.

- [ ] **Step 4: Inspect and commit evidence**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/dev...HEAD
```

Commit: `docs: record phase c stabilization verification`
