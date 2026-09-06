# C1.1 組織基礎 Implementation Plan

**Goal:** 已驗證的一般帳號可以建立組織、取得自己的組織清單與工作空間資料，不會因此取得平台審核權限。

**Architecture:** 沿用 Better Auth session；獨立組織 router、service、repository 與純函式 policy；以 PostgreSQL 同一 client 交易保證組織、Owner、稽核一起成功。先交付可測試的 C1.1，不暴露尚未完成的審核／刊登操作。

**Tech Stack:** Node.js 22、TypeScript、Express、Zod、PostgreSQL、Jest、Supertest。

## Global Constraints

- 分支 `feature/260907-foster-organizations`，基於 dev；不推送 dev/main，不自動 merge。
- 不碰使用者的 `.gitignore`、`docker-compose.yml`、既有未追蹤文件與圖片。
- 不變更政府 API 匯入、走失匹配、既有寄信及 OAuth 認證方式。
- 使用者已核准 C 設計與 `pg_trgm`；後者排入 C2 文字近似搜尋，不能當成語意理解或身分匹配。
- 本批不新增前端入口、平台 Reviewer 或對真實帳號授予新權限。

## Task 1：權限與輸入契約

Files: `src/contracts/organizations.ts`、`src/Service/organizations/policy.ts`、`src/Service/organizations/validation.ts`；測試 `src/__test__/unit/service/organizationPolicy.test.ts`。

- [x] 先寫 Editor/Admin/Owner、REMOVED、停權及未核准發布的拒絕案例，執行 focused test 確認 RED。
- [x] 實作 `canManageOrganization(context, action): boolean`；預設拒絕未知角色與動作，read 可讀停權狀態，write 只允許 ACTIVE。
- [x] `createOrganizationSchema` 僅允許 requestId、name、type、description、city、publicContact；不能透過 payload 指派 owner、role、APPROVED。
- [x] 測試空白、長度、額外欄位及 UUID，再執行 GREEN。

```ts
expect(createOrganizationSchema.safeParse({
  requestId: '11111111-1111-4111-8111-111111111111',
  name: '小橘中途', type: 'INDIVIDUAL', role: 'OWNER',
}).success).toBe(false);
```

## Task 2：資料表及交易 service

Files: `sql/V8__Foster_organizations.sql`、`src/Service/organizations/repository.ts`、`src/Service/organizations/service.ts`；真實 DB 驗證 `src/scripts/verify-organizations.ts`。

Interfaces:

```ts
create(actorId: string, raw: unknown): Promise<OrganizationWorkspace>
listMine(actorId: string, raw: unknown): Promise<OrganizationPage>
detail(actorId: string, organizationId: string): Promise<OrganizationWorkspace>
```

- [x] 先寫真實 PostgreSQL 驗證：隔離 schema、帳號 fixtures、建立／重試／跨帳號／跨組織拒絕；在 service 尚不存在時確認 RED。
- [x] V8 僅新增 organizations、memberships、audit；複合延後 FK 保證組織必有 ACTIVE Owner，部分唯一索引防止雙 Owner；user FK 不 cascade 刪除組織。
- [x] 同一交易內查驗帳號 Email、建立組織與 Owner、記錄 CREATED。失敗整筆回滾。
- [x] requestId 以建立者為範圍去重；同 key 同 payload 重回原組織，不同 payload 回 409；唯一約束處理並行重試。
- [x] 我的清單只包含目前 ACTIVE membership；cursor UUID 排序，pageSize 預設 20、最大 50。
- [x] 真實 DB 驗證重跑 migration 為零、零 Owner／雙 Owner／Owner 刪帳號約束、稽核失敗回滾、並行建立同 key 僅一筆。

隔離驗證只使用本機 DB、工具自己建立且名稱固定前綴加 UUID 的 schema；清理前驗證名稱，不刪 public 資料。部署回退只回退程式並保留新增資料表，不提供會誤刪組織資料的自動 down。

## Task 3：私有 HTTP API

Files: `src/router/organizationRouter.ts`、`src/router/index.ts`；測試 `src/__test__/integration/organizationRouter.test.ts`。

- [x] Supertest 先證明 endpoint 缺失；覆蓋 401、403 cross-origin、422、404 非成員、500 不洩漏內部錯誤。
- [x] 註冊 `/api/v1/organizations`，僅此 path 套用 session、requireUser、sameOrigin；必須位於既有 catch-all 私有 v1 router 之前。
- [x] POST 建立回 201，GET 清單回 `{organizations,nextCursor}`，GET `/:id` 回 `{organization}`，私人資料使用 `Cache-Control: no-store`。
- [x] 不接受 client userId 或 activeOrganizationId 作權限來源。
- [x] 執行 focused tests、全套 Jest、lint、backend type-check/build；記錄真實證據。

```sh
pnpm exec jest --runInBand organizationPolicy organizationRouter
pnpm exec tsx src/scripts/verify-organizations.ts
pnpm exec jest --runInBand
pnpm lint
pnpm build
```

## C1.1 驗證記錄（2026-09-07）

- 新增 focused tests 34 個通過；全套 Jest 56 suites / 356 tests 通過。
- Type-check、lint、backend build 通過；未更動 React，因此本批不宣稱 UI 驗收。
- 真實 PostgreSQL 隔離 schema 驗證通過；測試 schema 已清理，public 動物及使用者資料未被測試改寫。
- 本機開發 DB 已套用 V8（Applied 1）；migration checksum 由既有 runner 記錄。
- API 的 create/list/detail service 已完成；HTTP 測試隔離認證與 service，DB service 另以真實 DB 驗證，不把 mock 結果視為完整瀏覽器證據。
- 建立請求重試回傳目前有權限的工作空間投影；requestId 必須每次新意圖重新產生，同一意圖的重試沿用。HTTP POST 重試仍回 201，但不再建立資料。
- 本批暫時保留 CLOSED 組織的 Owner 與建立者參照；完整關閉／帳號刪除政策必須在開放相關操作前完成。

## 後續 C 批次（不宣稱已完成）

| 批次 | 交付 |
| --- | --- |
| C1.2 | 邀請、撤權、Owner 移轉、組織邀請寄信及稽核 |
| C1.3 | 平台審核、公開資料投影、發布／停權 |
| C1.4 | React 公開名錄與介紹、建立組織、後台切換及 OAuth 深連結 |
| C2 | 動物刊登、圖片、來源區分、條件／別名／pg_trgm 搜尋 |
| C3 | 認養申請、審核、結案及通知 |
