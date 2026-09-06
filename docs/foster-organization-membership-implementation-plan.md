# 中途之家成員管理實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: use incremental implementation and TDD. Complete one vertical slice at a time and keep each slice independently verifiable.

**目標：** 完成 C1.2 的成員邀請、角色與撤權管理、Owner 移轉，以及可重試的組織 Email，並提供簡潔可操作的 React 流程。

**架構：** 延續既有自有組織資料表與 Express service，不啟用 Better Auth organization plugin。所有 mutation 在單一 PostgreSQL transaction 內鎖定組織及相關 membership，再檢查 actor 當下權限；邀請與移轉只保存 token SHA-256，Email 由獨立 durable outbox worker 發送。

**技術：** PostgreSQL migration、TypeScript、Express、Zod、React、Jest、Supertest、Playwright、Nodemailer/Mailpit。

## 全域限制

- 工作分支以 `origin/dev` 為基底，PR 只開向 `dev`；本批不推送或合併。
- 不修改政府收容所資料，也不把中途之家會員資料放進公開 API。
- 每次 request 都以 session user 為 actor；忽略 client 傳入的 user/owner 身分。
- 邀請與移轉 token 不寫 log、不回到組織管理 API、不以明文存 DB。
- 組織停權或關閉時禁止成員 mutation；已移除的 member 立即失去 private workspace。
- UI 沿用現有暖色設計，320、768、1024、1440 px 均不可水平溢出。

---

### Task 1：資料不變量與私人契約

**Files**

- Create: `sql/V9__Organization_membership_management.sql`
- Modify: `src/contracts/organizations.ts`
- Modify: `src/Service/organizations/validation.ts`
- Test: `src/__test__/unit/sqlSchema.test.ts`
- Test: `src/__test__/unit/service/organizationPolicy.test.ts`

**Interfaces**

- `OrganizationMember` 只回傳成員 id、顯示名稱、Email、role 與 joinedAt。
- `OrganizationInvitationSummary` 只回傳 invitation id、遮罩前不需要的原始 token 不包含在內、Email、role、status、expiresAt。
- 邀請 token 與移轉 token 僅存在寄信連結中；資料表保存 `token_hash CHAR(64)`。

- [ ] 先新增 failing schema/policy tests：同組織同 Email 只能有一筆 pending 邀請、同組織只能有一筆 pending Owner 移轉、outbox dedupe key 唯一、Admin 不能授予 Admin 或操作 Owner。
- [ ] 執行 `pnpm exec jest src/__test__/unit/sqlSchema.test.ts src/__test__/unit/service/organizationPolicy.test.ts --runInBand`，確認因 V9 與新 policy 缺少而失敗。
- [ ] 新增 invitation、ownership transfer、organization mail outbox 表及索引；新增 Zod UUID、Email、role validation。
- [ ] 重跑 focused tests，預期通過。
- [ ] Commit：`feat: add organization membership lifecycle schema`。

### Task 2：邀請、接受與撤銷的完整流程

**Files**

- Create: `src/Service/organizations/membershipRepository.ts`
- Create: `src/Service/organizations/membershipService.ts`
- Modify: `src/router/organizationRouter.ts`
- Modify: `src/router/index.ts`
- Test: `src/__test__/integration/organizationMembershipRouter.test.ts`

**Interfaces**

- `GET /api/v1/organizations/:id/members` → `{ members, invitations, transfer, capabilities }`。
- `POST /api/v1/organizations/:id/invitations` body `{ email, role }` → 201 invitation summary；重邀會原子撤銷舊 token。
- `POST /api/v1/organizations/:id/invitations/:invitationId/revoke` → 204。
- `GET /api/v1/organization-invitations/:token` → 組織名稱、邀請角色、到期時間、是否為目前正確帳號。
- `POST /api/v1/organization-invitations/:token/accept|decline` → 接受後建立或恢復 membership；既有 active member 不會被升權。

- [ ] 寫 failing HTTP/DB tests：未登入、跨來源、Editor 邀請、Admin 邀 Admin、錯誤 Email、未驗證 Email、過期/撤銷/重放 token、邀請者事後撤權、停權組織、重邀、既有 member 升權。
- [ ] 執行 focused Jest，確認 endpoints 尚不存在而失敗。
- [ ] 實作 transaction lock、parameterized SQL、generic token error、audit event 與 outbox enqueue。
- [ ] 重跑 focused tests，預期通過。
- [ ] Commit：`feat: add secure organization invitations`。

### Task 3：角色、撤權與 Owner 移轉

**Files**

- Modify: `src/Service/organizations/membershipRepository.ts`
- Modify: `src/Service/organizations/membershipService.ts`
- Modify: `src/router/organizationRouter.ts`
- Test: `src/__test__/integration/organizationMembershipRouter.test.ts`

**Interfaces**

- `PATCH /api/v1/organizations/:id/members/:userId` body `{ role: 'ADMIN' | 'EDITOR' }`。
- `POST /api/v1/organizations/:id/members/:userId/remove` → 204。
- `POST /api/v1/organizations/:id/ownership-transfers` body `{ toUserId }` → 201 transfer summary。
- `POST /api/v1/organizations/:id/ownership-transfers/:transferId/revoke` → 204。
- `GET /api/v1/organization-ownership-transfers/:token` 與 `POST .../:token/accept|decline`。

- [ ] 寫 failing tests：self-removal、操作 Owner、Admin 操作 Admin、移轉給非 active member、非收件人接受、過期/重放、並行接受、舊 Owner 撤權、DB 始終一位 active Owner。
- [ ] 執行 focused Jest，確認缺少行為而失敗。
- [ ] 實作分層權限與鎖順序 `organization → memberships → transfer`；接受時同步更新 organization owner、舊 Owner 為 Admin、接任者為 Owner。
- [ ] 重跑 focused tests 與 organization verifier，預期通過。
- [ ] Commit：`feat: add member roles and ownership transfer`。

### Task 4：組織 Email outbox worker

**Files**

- Create: `src/repository/organizationMail.db.ts`
- Create: `src/workers/organizationMailWorker.ts`
- Modify: `src/Service/mail.ts`
- Modify: `src/workers/index.ts`
- Test: `src/__test__/unit/worker/organizationMailWorker.test.ts`

**Interfaces**

- `OrganizationMailRepository.claim()` 僅 claim 仍有效且未過期的 pending invitation/transfer，失效工作標成 `CANCELLED`。
- `OrganizationMailWorker.runOnce()` 最多嘗試三次，1/5 分鐘 backoff；SMTP 失敗只記分類，不記 Email 或 token。
- 邀請連結為 `/organization-invitations/:token`；移轉連結為 `/organization-ownership-transfers/:token`。

- [ ] 寫 failing worker tests：寄送成功、已撤銷不寄、SMTP retry/terminal failure、寄信不受走失通知偏好影響。
- [ ] 執行 focused Jest，確認 worker 尚不存在而失敗。
- [ ] 實作 repository、純文字 Email 及 worker loop 整合。
- [ ] 重跑 focused tests，預期通過。
- [ ] Commit：`feat: deliver durable organization emails`。

### Task 5：React 成員管理與邀請處理

**Files**

- Create: `web/src/features/organizations/OrganizationMembers.tsx`
- Create: `web/src/features/organizations/OrganizationInvitationPage.tsx`
- Create: `web/src/features/organizations/OwnershipTransferPage.tsx`
- Modify: `web/src/features/organizations/OrganizationPages.tsx`
- Modify: `web/src/features/auth/AuthPage.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`
- Test: `tests/web-e2e/organization-membership.spec.ts`

**UX acceptance**

- Workspace 只有可管理者看到「邀請成員」；Editor 只看到成員名單，不看到 Email 與操作按鈕。
- 邀請表單預設 Editor，角色選項只顯示 actor 真正能授予的角色；成功後清空 Email 並把 pending 邀請放入同一區塊。
- 每一列只顯示名稱/Email、角色與可用操作；不顯示 UUID、raw enum、audit 資訊。
- 撤銷、移除、Owner 移轉使用具體對象名稱的確認訊息；按鈕 pending 時 disabled，失敗留在原畫面可重試。
- 邀請連結未登入時保留安全 returnTo；登入錯誤帳號時只顯示「請切換至受邀 Email」，不洩漏完整 token/其他會員。
- 接受後導向新組織 workspace；拒絕後導向組織清單。Owner 接受移轉後重新載入 workspace 權限。

- [ ] 先寫 Playwright failing tests：Owner 邀請/撤銷、Admin 只邀 Editor、Editor readonly、wrong-account invitation、accept/decline、remove/role change、ownership transfer、keyboard 與四種 viewport。
- [ ] 執行 `pnpm test:web:e2e -- organization-membership.spec.ts`，確認 UI 尚不存在而失敗。
- [ ] 實作三個聚焦元件與 route 白名單；使用既有 Feedback、button、panel 和 notice 樣式。
- [ ] 重跑 focused Playwright，預期通過且無 console error/水平溢出。
- [ ] Commit：`feat: add organization member management UI`。

### Task 6：整體驗收與文件

**Files**

- Modify: `docs/foster-organizations-implementation.md`
- Create: `docs/foster-organization-membership-acceptance.md`

- [ ] 套用 V9 至隔離 schema，再套用本機 dev DB；第二次 migration 應為 0。
- [ ] 執行完整 Jest、backend build、frontend build、ESLint 與 `git diff --check`。
- [ ] 用 Mailpit 驗證邀請信與 Owner 移轉信的連結可用、撤銷後不能接受、SMTP failure 可重試。
- [ ] 執行完整 Playwright，確認既有登入、通報、配對、寄信、收容所與組織流程無回歸。
- [ ] 實際檢視桌面與 320 px 畫面，只記錄已實際驗證的結果。
- [ ] Commit：`docs: record organization membership acceptance`。
