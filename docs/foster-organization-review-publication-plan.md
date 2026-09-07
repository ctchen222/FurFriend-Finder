# 中途之家審核與公開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use incremental implementation and TDD. Complete each vertical slice and verify it before continuing.

**Goal:** 完成 C1.3 的組織資料編輯、平台 Reviewer 審核與停權、組織發布控制，以及訪客公開名錄／介紹頁。

**Architecture:** 平台角色、審核資料與組織 membership 完全分離。私人 workspace、Reviewer queue、公開 organization 各自使用不同 TypeScript response contract 與 repository query；公開查詢只從 `APPROVED + ACTIVE + published_at` 資料建立 allowlist projection。

**Tech Stack:** PostgreSQL、TypeScript、Express、Zod、React、Jest、Supertest、Playwright。

## Global Constraints

- 延續 `feature/260907-foster-organizations`，PR 仍以 `dev` 為目標；不推送或合併。
- Reviewer 預設不存在，必須由本機操作者工具明確授予；不能依 Email 或組織角色推導。
- Reviewer 不得審核、停權或恢復自己是有效成員的組織。
- 審核通過不自動公開；組織 Owner/Admin 必須主動發布。
- 名稱或類型變更會取消公開並回到 `PENDING`；介紹、地區及公開聯絡方式修改保留既有審核狀態。
- 停權會在同一交易取消公開；恢復 ACTIVE 不自動重新發布。
- 公開 API 不回傳 member、Email、review reason、version、audit 或 operational/review status。
- 所有 mutation 使用 expectedVersion 防止兩個頁籤互相覆寫，衝突回 409。
- UI 沿用現有暖色樣式，只顯示狀態對應的下一個操作，並驗收鍵盤與 320／768／1024／1440 px。

---

### Task 1：平台角色與審核狀態機

**Files**

- Create: `sql/V10__Organization_review_and_publication.sql`
- Create: `src/Service/organizations/reviewRepository.ts`
- Create: `src/Service/organizations/reviewService.ts`
- Create: `src/router/organizationReviewRouter.ts`
- Create: `src/scripts/manage-platform-role.ts`
- Modify: `src/contracts/organizations.ts`
- Modify: `src/Service/organizations/validation.ts`
- Modify: `src/router/index.ts`
- Test: `src/__test__/unit/service/organizationPolicy.test.ts`
- Test: `src/__test__/integration/organizationReviewRouter.test.ts`

**Interfaces**

- `GET /api/v1/reviewer/organizations?view=PENDING&pageSize=20&cursor=<uuid>` 回傳必要審核資料及 cursor。
- `POST /api/v1/reviewer/organizations/:id/reviews` body `{ expectedVersion, decision, reason }`。
- `POST /api/v1/reviewer/organizations/:id/suspensions` body `{ expectedVersion, reason }`。
- `POST /api/v1/reviewer/organizations/:id/reactivations` body `{ expectedVersion, reason }`。

- [ ] 先寫 RED tests：無 Reviewer 403、自審 403、舊版本 409、重複決定、未填拒絕／停權理由 422、停權取消公開、恢復不自動發布。
- [ ] 新增 `platform_roles`、`platform_role_events`、`organization_reviews` 及 moderation audit 欄位；唯一 `(organization_id, organization_version)` 防止同版本重複決定。
- [ ] 實作固定鎖順序 `platform role → organization → membership check`；審核及 moderation 都記錄 reviewer、版本、理由與時間。
- [ ] 實作只接受本機 DB 存取權的 grant/revoke CLI，操作者標籤寫入 event，不輸出 Email 或其他帳號資料。
- [ ] 跑 focused Jest 與隔離 PostgreSQL verifier後提交 `feat: add organization review workflow`。

### Task 2：組織設定與發布控制

**Files**

- Create: `src/Service/organizations/profileRepository.ts`
- Create: `src/Service/organizations/profileService.ts`
- Modify: `src/router/organizationRouter.ts`
- Modify: `src/contracts/organizations.ts`
- Modify: `src/Service/organizations/validation.ts`
- Test: `src/__test__/integration/organizationRouter.test.ts`

**Interfaces**

- `PATCH /api/v1/organizations/:id/profile` body 為完整公開欄位及 `expectedVersion`，回 `{ organization }`。
- `POST /api/v1/organizations/:id/publications` body `{ expectedVersion }`，只允許 APPROVED/ACTIVE Owner 或 Admin。
- `DELETE /api/v1/organizations/:id/publications` body `{ expectedVersion }`，冪等取消公開。

- [ ] 先寫 RED tests：Editor 修改、停權修改、stale version、名稱／類型變更重新送審、一般欄位更新、未核准發布與重複取消公開。
- [ ] 在單一 transaction 重新查 membership、鎖 organization、比對 version 後更新；public projection 不由 client 控制。
- [ ] 名稱／類型真的改變才重置審核與發布；相同 payload 不造成不必要重審。
- [ ] 跑 focused tests 與 build後提交 `feat: add organization profile and publication controls`。

### Task 3：公開唯讀 API

**Files**

- Create: `src/Service/organizations/publicRepository.ts`
- Create: `src/Service/organizations/publicService.ts`
- Create: `src/router/publicOrganizationRouter.ts`
- Modify: `src/router/index.ts`
- Test: `src/__test__/integration/publicOrganizationRouter.test.ts`

**Interfaces**

- `GET /api/v1/public/organizations?q=&city=&type=&pageSize=&cursor=` → `{ organizations, nextCursor }`。
- `GET /api/v1/public/organizations/:id` → `{ organization }`，未發布、不存在、停權一律 404。
- `PublicOrganization` 僅含 `id,name,type,description,city,publicContact,publishedAt`。

- [ ] 寫 RED tests：匿名可讀、未發布／停權 404、私人欄位不出現在 JSON、wildcard 當一般文字、穩定 cursor 與 bounded pageSize。
- [ ] 實作 allowlist SELECT，不重用 private workspace row；所有 public response 使用短期 `Cache-Control: public, max-age=60`，錯誤不快取。
- [ ] 跑 focused tests 與真實 DB projection verifier後提交 `feat: add public foster organization directory API`。

### Task 4：React 管理、Reviewer 與公開頁

**Files**

- Create: `web/src/features/organizations/OrganizationProfileEditor.tsx`
- Create: `web/src/features/organizations/PublicOrganizationPages.tsx`
- Create: `web/src/features/organizations/OrganizationReviewPage.tsx`
- Modify: `web/src/features/organizations/OrganizationPages.tsx`
- Modify: `web/src/features/auth/SessionProvider.tsx`
- Modify: `web/src/ui/Layout.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`
- Modify: `src/router/reactWebRouter.ts`
- Modify: `src/router/webApiRouter.ts`
- Test: `tests/web-e2e/organization-publication.spec.ts`

**UX acceptance**

- 所有訪客主導覽看到「中途之家」；未登入即可篩選並開啟已發布組織。
- Workspace 僅 Owner/Admin 看到「編輯介紹」；儲存後清楚說明是否需要重新審核。
- 只有 APPROVED/ACTIVE 顯示發布按鈕；已發布顯示「查看公開頁」與「取消公開」；PENDING/REJECTED 不顯示無效按鈕。
- Reviewer 導覽只對 `isOrganizationReviewer` 顯示；待審核畫面每次只要求核准或填理由退回，不顯示會員名單。
- 公開頁只呈現名稱、類型、地區、介紹與自願公開聯絡方式；沒有資料的欄位不佔版面，不顯示開發提示或內部代碼。
- mutation pending 時 disabled；錯誤保留表單；版本衝突提示重新載入，不偷偷覆寫。

- [ ] 先寫 Playwright RED tests：匿名名錄／detail、Owner 編輯重審與發布、Editor 無控制、Reviewer 自審拒絕與停權、公開資料無 Email、四種寬度與鍵盤操作。
- [ ] 實作三組聚焦元件與 safe route 白名單，不把 Reviewer state 放在 localStorage。
- [ ] 跑 focused Playwright，檢視實際畫面並修正資訊層級。
- [ ] 完整執行 Jest、Playwright、build、ESLint、migration 重跑及 `git diff --check`，更新驗收文件後提交。
