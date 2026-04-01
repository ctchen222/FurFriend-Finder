# AI 自動化開發工作流程策略

> 基於 Stripe Minions 架構設計，為 FurFriend Finder 量身打造的 AI 輔助開發流程。
> 建立日期：2026-03-30

---

## 目錄

1. [核心理念](#1-核心理念)
2. [認證與費用規劃](#2-認證與費用規劃)
3. [Token 控制策略](#3-token-控制策略)
4. [兩階段工作流設計](#4-兩階段工作流設計)
5. [本地驗證流程](#5-本地驗證流程)
6. [GitHub Actions 目標架構](#6-github-actions-目標架構)
7. [關鍵決策記錄](#7-關鍵決策記錄)
8. [階段性里程碑](#8-階段性里程碑)

---

## 1. 核心理念

本流程直接採用 Stripe Minions 的設計哲學，但依照個人/小型專案的規模裁剪：

> **你說「去做 X」，AI 做完通知你，你只看結果。**

### 角色轉換

| 傳統方式 | 本流程 |
|---------|-------|
| 你坐在電腦前監督每一步 | 你下指令後離開 |
| 你手動跑測試 | 自動跑，失敗自動重試 |
| 你手動 commit + push | 自動開 PR 等你審查 |
| **你是執行者** | **你是審查者** |

### 三大設計原則

1. **本地先驗證，CI 後實作** — 不要一開始就押注 CI 費用
2. **人工在觸發前把關** — 不是在 AI 跑完才看，而是觸發前就確認範圍
3. **費用可預測** — 每次 PR 的成本在觸發前就能估算

---

## 2. 認證與費用規劃

### 兩套完全獨立的系統

| | Claude Max 訂閱 | Anthropic API |
|--|----------------|---------------|
| 用途 | 本地 Claude Code 互動 | GitHub Actions / 程式呼叫 |
| 認證 | OAuth（瀏覽器登入） | `ANTHROPIC_API_KEY` |
| 計費 | 月費訂閱 | 按 token 用量 |
| 取得方式 | claude.com/pricing | console.anthropic.com |

> ⚠️ **重要**：Claude Max 訂閱無法直接用於 GitHub Actions。CI 環境需要從 `console.anthropic.com` 申請獨立的 API Key，費用分開計算。

### 費用估算

每次 PR pipeline（「修復失敗測試」類型任務）的估計費用：

| 模型 | Input/M tokens | Output/M tokens | 每次 PR 估算 |
|------|---------------|-----------------|------------|
| **Sonnet 4.6**（預設） | $3 | $15 | $0.10–$0.35 |
| **Haiku 4.5**（省錢） | $0.25 | $1.25 | $0.01–$0.03 |

**月費試算（50 次 PR）：**
- Sonnet：$5–$17/月
- Haiku：$0.50–$1.50/月

### 費用控制措施

```yaml
# GitHub Actions 中設定
claude_args: "--max-turns 2 --model claude-haiku-4-5-20251001"
```

- `--max-turns 2`：最多 2 輪重試（Stripe 設計的上限）
- 簡單任務用 Haiku，複雜任務再換 Sonnet
- `console.anthropic.com` → Billing 設定月費上限警告

---

## 3. Token 控制策略

### 最危險的 Token 爆炸場景

1. **Claude 讀了 `node_modules/`**（最常見）— 直接清空 context window
2. **任務描述模糊** — Claude 要先「探索」才能開始，消耗大量 input token
3. **冗長的測試失敗訊息被反覆帶入** — 每輪都帶著 10,000 行 stack trace
4. **改一個地方引發連鎖 TypeScript 錯誤** — 每個錯誤都要讀對應檔案

### 四層防護

#### 層 1：`.claudeignore`（最簡單，效果最大）

```
node_modules/
dist/
package-lock.json
*.lock
coverage/
.claude/worktrees/
images/
```

省掉 50–80% 的無效 token 讀取。

#### 層 2：`CLAUDE.md` 限制讀取範圍

```markdown
- 每次任務只讀與任務直接相關的檔案
- 不要用 glob 掃整個 src/ 目錄
- 超過 3 個檔案需要修改時，先列出計劃等確認
```

#### 層 3：任務描述精確給出檔案路徑

```bash
# ❌ 模糊（Claude 要先探索）
./scripts/minion.sh "修復配對系統的問題"

# ✅ 精確（直接開工）
./scripts/minion.sh "在 src/__test__/unit/service/animalLost.service.test.ts \
  補充 found_place 為空字串時 distance=Infinity 的測試案例"
```

#### 層 4：`--max-turns 2` 硬性上限

統計上：
- k=1 成功率 60–70%
- k=2 成功率 85–90%
- k=3 以後幾乎沒有提升，只是浪費 token

---

## 4. 兩階段工作流設計

### 問題：如何在不浪費 token 的前提下確認 AI 的方向？

**解法：先讓 AI 輸出計劃，人工確認後才實作。**

### 完整流程

```
你開 Issue：「補充 found_place 空字串的測試」
        ↓
貼上 claude-plan label
        ↓
[Phase 1] Claude 讀 Issue → 輸出計劃留言（不寫程式碼）
  範例計劃留言：
  「計劃：
   1. 修改 src/__test__/unit/service/animalLost.service.test.ts
   2. 在 findMatches describe 區塊新增 it(...)
   3. 影響範圍：只有測試檔案，不動 production code
   預估修改：1 個檔案，新增約 15 行」
        ↓
你回覆：approved（或說明需要調整的地方）
        ↓
[Phase 2] Claude 照計劃實作 → 建 branch → 開 PR
        ↓
你審查 PR → merge
```

### 觸發規則

| Label | 觸發行為 | 適用情況 |
|-------|---------|---------|
| `claude-plan` | Phase 1：出計劃 | 你想先看 AI 打算怎麼做 |
| 回覆 `approved` | Phase 2：實作 | 你確認計劃方向正確 |

> 注意：只有 `ctchen`（repo 擁有者）的 `approved` 留言才能觸發 Phase 2，防止他人觸發。

---

## 5. 本地驗證流程

### 使用 `scripts/minion.sh`

```bash
# 基本用法
./scripts/minion.sh "在 animalLost.service.test.ts 補充 found_place 空字串的 Infinity distance 測試"

# 指定模型（省錢用 Haiku）
MODEL=claude-haiku-4-5-20251001 ./scripts/minion.sh "修復 lint 錯誤"
```

### 腳本執行流程

```
[確定性] 任務長度檢查（>30 字）
    ↓
[確定性] 建立獨立 git branch（minion/YYYYMMDD-HHMMSS）
    ↓
[代理]   claude --print 執行任務
    ↓
[確定性] npm run build
    ↓
[反饋迴圈，上限 2 次]
  npm test → 若失敗 → claude --print "修復失敗測試" → 重試
    ↓
[確定性] 成功：git commit + gh pr create
[失敗]   超過上限：提示需要人工介入，刪除 branch
```

### 驗收標準

本地驗證通過的條件：
- [ ] 任務描述精確（含目標檔案路徑）
- [ ] `npm test` 全部通過（183 tests）
- [ ] PR 建立成功，可以在 GitHub 看到
- [ ] PR 內容符合任務描述

---

## 6. GitHub Actions 目標架構

> 這是**下一階段**的目標，本地驗證通過後才實作。

### 需要的檔案

```
.github/
  workflows/
    claude-plan.yml      # Phase 1：出計劃
    claude-implement.yml # Phase 2：實作
  ISSUE_TEMPLATE/
    # 不需要強制 template，用 CLAUDE.md 約束取代
```

### claude-plan.yml 概要

```yaml
on:
  issues:
    types: [labeled]
jobs:
  plan:
    if: github.event.label.name == 'claude-plan'
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "讀取這個 Issue，只輸出實作計劃，不要寫任何程式碼。列出要修改的檔案、改動內容、影響範圍。"
          claude_args: "--max-turns 3"
```

### claude-implement.yml 概要

```yaml
on:
  issue_comment:
    types: [created]
jobs:
  implement:
    if: |
      github.event.comment.body == 'approved' &&
      github.event.comment.user.login == 'ctchen'
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "依照上面計劃的留言實作，完成後開 PR"
          claude_args: "--max-turns 2"
```

### 需要的 Secrets

```
ANTHROPIC_API_KEY  ← 從 console.anthropic.com 取得
```

---

## 7. 關鍵決策記錄

| 決策 | 結論 | 原因 |
|------|------|------|
| 認證方式 | 本地用 Max 訂閱，CI 用 API Key | Max ≠ API Key，兩套分開計費 |
| 費用上限 | `--max-turns 2` | 邊際效益遞減，第 3 輪幾乎不會成功 |
| 任務粒度 | 一個 Issue = 一個任務 | 搭配 CLAUDE.md 範圍限制 |
| Issue 品質 | CLAUDE.md 約束（非強制 template） | 強制 template 反而降低使用意願 |
| 審核機制 | AI 先出計劃留言，人工 approved | 觸發前確認方向，避免跑偏 |
| 觸發機制 | label 觸發 | 非所有 Issue 都自動觸發，人工過關 |
| 預設模型 | Haiku（簡單任務），Sonnet（複雜任務） | 費用相差 10 倍 |

---

## 8. 階段性里程碑

### 階段一：本地驗證（現在）✅

- [x] `.claudeignore` 建立
- [x] `CLAUDE.md` 建立
- [x] `scripts/minion.sh` 建立（含 Plan → Approve → Implement 流程）
- [x] 用第一個真實任務測試跑通（183 tests passed, 0 retries）

**驗收：** `scripts/minion.sh` 成功建立 PR，內容正確 ✅

### 階段二：GitHub Actions（本地通過後）

- [ ] 申請 `console.anthropic.com` API Key
- [ ] 將 `feature/ai-minion-workflow` merge 進 main
- [ ] 在 GitHub repo 建立 `claude-plan` label
- [ ] 建立 `claude-plan.yml`（Phase 1：出計劃）
- [ ] 建立 `claude-implement.yml`（Phase 2：實作，含讀取 Phase 1 計劃留言）
- [ ] 測試端到端流程（Issue → 計劃留言 → approved → PR）

**驗收：** 從開 Issue 到 PR 全程不需要手動介入

### 階段三：優化（穩定運行後）

- [ ] 依任務類型自動選擇 Haiku / Sonnet
- [ ] Token 用量追蹤 Dashboard
- [ ] 常用任務類型整理為 Issue 描述範本

---

## 9. Billing 可觀測性

### 如何看每次 PR 的 token 用量

**方法 1：GitHub Actions log（即時）**

每次 `claude-code-action` 執行完，Actions log 裡會顯示本次使用的 input/output tokens。
位置：`Actions` tab → 選對應的 workflow run → 展開 `Run Claude Code` 步驟。

**方法 2：Anthropic Console dashboard（彙總）**

前往 `console.anthropic.com` → `Usage`，可以看到：
- 每日 / 每月 token 用量
- 按 API key 分類的用量（建議為 CI 建立獨立的 API key，方便追蹤）
- 費用明細

**方法 3：PR body 記錄（被動追蹤）**

`claude-implement.yml` 可以在 PR body 加入 token 統計，但 `claude-code-action` 目前不直接輸出 token 數；需要自行在 workflow 中解析 log 或改用 API 直接呼叫。

### 設定費用警告上限

1. 前往 `console.anthropic.com` → `Billing` → `Usage limits`
2. 設定 `Monthly spend limit`（超過後 API 呼叫會被拒絕，CI 會失敗但不會繼續扣費）
3. 設定 `Email alert threshold`（例如達到上限的 80% 時發通知）

### 建議的費用控制設定

```yaml
# claude-implement.yml 中
claude_args: "--max-turns 2 --model claude-haiku-4-5-20251001"
```

| 場景 | 模型 | 估算費用/次 |
|------|------|------------|
| 加測試、補文件 | Haiku | $0.01–$0.03 |
| 修 bug、小功能 | Haiku | $0.02–$0.05 |
| 跨多檔案重構 | Sonnet | $0.10–$0.35 |

---

## 參考資料

- [Stripe Minions 架構分析](./stripe-minions-analysis.md)
- [Claude Code GitHub Actions 官方文件](https://code.claude.com/docs/en/github-actions)
- [Anthropic Console（用量與費用）](https://console.anthropic.com)
- [Anthropic Console（API Key 管理）](https://console.anthropic.com)
