# C1.3 中途之家審核與公開驗收

日期：2026-09-07

## 已交付流程

```text
組織建立（PENDING）
  → 獨立 Reviewer 核准（APPROVED）
  → Owner / Admin 主動公開
  → 所有訪客可瀏覽公開名錄與介紹

Reviewer 停權
  → 立即取消公開
  → 組織只能讀取狀態
  → 恢復運作後仍需 Owner / Admin 再次公開
```

- Reviewer 是平台角色，不由 Email 或組織角色推導，也不能審核自己參與的組織。
- 公開 API 僅輸出名稱、類型、介紹、縣市、自願公開聯絡方式與發布時間。
- 名稱或類型變更會重新送審並下架；已核准組織修改介紹、地區或公開聯絡方式時保留核准狀態。
- 被退回的組織修改資料後會重新送審。
- 所有審核、發布、停權 mutation 都使用版本欄位防止覆寫較新的資料。
- Owner 移轉期限已校正為 24 小時；一般成員邀請仍維持 7 天。

## 本機操作

套用 migration：

```bash
pnpm db:migrate
```

由具名操作者授予或撤銷 Reviewer；每次操作都寫入 `platform_role_events`：

```bash
pnpm reviewer:role -- grant reviewer@example.com local-admin
pnpm reviewer:role -- revoke reviewer@example.com local-admin
```

登入 Reviewer 帳號後，從導覽列進入 `/review/organizations`。所有訪客可直接開啟 `/foster-organizations`。

## 驗證證據

- `pnpm type-check`：通過。
- `pnpm lint`：通過。
- `pnpm build`、`pnpm build:web`：通過。
- `pnpm exec jest --runInBand`：59 suites、383 tests 通過。
- `pnpm verify:organization-review`：隔離 PostgreSQL schema 完整流程通過，結束後已刪除該 disposable schema。
- `pnpm db:migrate`：首次套用 V10 為 1，第二次為 0。
- `pnpm test:web:e2e`：29 個 Chrome 流程通過，包含 auth、組織成員、公開頁、Reviewer、走失協尋、寄信與手機寬度。

本次未包含 C2 動物刊登、認養申請或 `pg_trgm` 動物搜尋。
