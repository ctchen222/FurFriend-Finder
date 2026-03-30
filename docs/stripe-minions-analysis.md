# Stripe Minions 架構分析：AI 驅動的無人值守開發流程

> 原文：[How Stripe's Minions Ship 1300 PRs](https://blog.bytebytego.com/p/how-stripes-minions-ship-1300-prs)
> 整理日期：2026-03-29

---

## 背景與核心理念

Stripe 開發了稱為 **Minions** 的無人值守 AI 代理系統，能夠自動處理編碼任務。與 Cursor 或 Claude Code 等需要人工監督的工具不同，Minions **完全獨立運作**：

- 工程師在 Slack 下指令後便可離開
- 系統自動完成：建分支 → 寫程式碼 → 跑測試 → 修錯誤 → 開 PR
- 工程師的角色從「**寫程式的人**」轉變為「**審查程式的人**」

Stripe 的核心洞察是：**成功的關鍵不在於 AI 模型本身，而在於底層的開發環境基礎設施。**

---

## 五大核心概念

### 1. 無人值守代理（Unattended Agent）

工程師透過 Slack 發出任務指令後即可離開，代理全程自主運作直到完成 PR。

**設計原則：**
- 代理在隔離環境中運行，不影響主線
- 完成後才通知工程師「有 PR 等你審查」
- 不完美的 PR 仍有價值，工程師通常能在 **20 分鐘內** 完善半正確的輸出

---

### 2. 預熱開發環境（Pre-warmed Devboxes）

每個代理擁有獨立的雲端機器，可在 **10 秒內啟動**（因為事先準備好機器池）。

| 特性 | 說明 |
|------|------|
| **隔離性** | 運行在 QA 環境，與生產系統完全分離 |
| **並行性** | 多個代理可同時在獨立機器上工作 |
| **可預測性** | 每個代理從乾淨、一致的狀態啟動 |

---

### 3. Blueprint 混合編排（Hybrid Orchestration）

Blueprint 是工作流程定義，結合兩種步驟類型：

| 步驟類型 | 例子 | 誰決定 |
|---------|------|--------|
| **確定性步驟** | lint、格式化、推分支 | 固定規則，不使用 LLM |
| **代理步驟** | 實作功能、修復失敗測試 | LLM 自主決策 |

**設計優勢：**
- 減少不必要的 token 消耗
- 提高整體可靠性（確定性的事不讓 AI 猜測）
- 清晰界定「機器決定」與「AI 決定」的邊界

---

### 4. MCP 工具精選子集（Curated Toolset via MCP）

Stripe 建立了稱為 **Toolshed** 的內部 MCP server，包含約 **500 個工具**（查資料庫、呼叫 API、讀文件等）。

**關鍵設計決策：** 每個代理只接收與當前任務相關的精選工具子集。

**原因：**
- 避免 context window 溢出
- 降低代理選錯工具的機率
- 提升每次任務的執行效率

---

### 5. 反饋迴圈上限（Feedback Loop Hard Cap）

系統實施**硬性上限：最多兩輪 CI 失敗修復嘗試**，超過後自動升級給人工工程師。

```
本地 lint → (5 秒內完成)
    ↓
CI 選擇性測試 → 若失敗，代理修復 (Round 1)
    ↓
重新跑測試 → 若仍失敗，代理修復 (Round 2)
    ↓
超過 2 輪 → 標記 human review needed，通知工程師
```

**設計原理：** 多次重試產生**邊際收益遞減**。統計上：
- k=1 成功率約 60-70%
- k=2 成功率提升至 85-90%
- k=3 以後提升幅度極小

---

## 對 FurFriend Finder 的實作可行性

### 現有技術基礎

本專案（Express + TypeScript + Jest + Docker + Playwright）已具備多項前置條件：

| 概念 | 現有基礎 | 可行性 | 難度 |
|------|---------|--------|------|
| 無人值守代理 | Claude Code CLI、git worktree | ✅ 可行 | 中 |
| 預熱 Devbox | Docker + docker-compose.yml | ✅ 可行 | 低 |
| Blueprint 編排 | npm scripts（build/test/lint） | ✅ 可行 | 低 |
| MCP 工具精選 | .claude/settings.json | ✅ 可行 | 中 |
| 反饋迴圈上限 | 無需前置條件 | ✅ 最易實作 | 很低 |

### 各概念具體實作方式

#### 概念 1：無人值守代理
```bash
# 用 Claude Code CLI + git worktree 實作
git worktree add /tmp/feature-branch feature/new-task
cd /tmp/feature-branch
claude --print "實作搜尋過濾器功能，根據 docs/requirements.md"
npm test
gh pr create --title "feat: 新增搜尋過濾器"
```

#### 概念 2：預熱 Devbox（Docker）
```yaml
# docker-compose.yml 已存在，擴展即可
services:
  agent-runner:
    build: .
    environment:
      - NODE_ENV=test
    volumes:
      - .:/app
    command: sh -c "npm test"
```

#### 概念 3：Blueprint 編排（Shell Script）
```bash
#!/bin/bash
# blueprint.sh - 混合確定性 + 代理步驟

# [確定性] Step 1: 編譯檢查
npm run build || exit 1

# [確定性] Step 2: Lint
npx eslint src/ || exit 1

# [代理] Step 3: 若測試失敗，呼叫 Claude 修復
RETRIES=0
MAX_RETRIES=2
while [ $RETRIES -lt $MAX_RETRIES ]; do
  npm test && break
  RETRIES=$((RETRIES+1))
  claude --print "修復失敗的測試，不要改動業務邏輯"
done

# 超過上限 → 通知人工審查
if [ $RETRIES -ge $MAX_RETRIES ]; then
  echo "❌ 超過自動修復上限，需要人工審查"
  exit 1
fi

# [確定性] Step 4: 建立 PR
gh pr create --title "自動修復" --body "由 Minion 自動產生"
```

#### 概念 4：MCP 工具精選（依任務類型分組）
```json
// .claude/settings.json 中按任務類型設定工具子集
{
  "taskProfiles": {
    "bug-fix": ["read", "edit", "grep", "run-tests"],
    "new-api": ["read", "write", "db-schema", "run-tests"],
    "fix-tests": ["read", "edit", "run-tests"]
  }
}
```

#### 概念 5：反饋迴圈上限（最簡實作）
```bash
MAX_RETRIES=2
RETRIES=0

while [ $RETRIES -lt $MAX_RETRIES ]; do
  npm test && echo "✅ 測試通過" && exit 0
  RETRIES=$((RETRIES+1))
  echo "第 $RETRIES 次修復嘗試..."
  claude --print "修復測試"
done

echo "⚠️ 已達最大重試次數，需要人工介入"
```

---

## 實作優先順序建議

### 階段一（立即可做，低成本高效益）
1. **反饋迴圈上限** → 在現有 npm test 流程中加入重試上限邏輯
2. **Blueprint 編排腳本** → 建立 `scripts/blueprint.sh` 串連 build + lint + test

### 階段二（中期，需要 GitHub 帳號設定）
3. **GitHub Actions Blueprint** → 將 blueprint 腳本搬到 CI/CD 流程
4. **自動 PR 建立** → 整合 `gh pr create`，代理完成後自動開 PR

### 階段三（進階，需要較多整合工作）
5. **Docker 隔離環境** → 每個代理任務啟動獨立 container
6. **MCP 工具精選** → 依任務類型設計不同的工具子集配置

---

## 總結

Stripe Minions 最核心的價值主張是：

> **把 AI 從「輔助工具」提升為「自動化流水線中的執行者」**，人類負責定義目標和審查結果，而非親自執行每一行程式碼。

對於 FurFriend Finder 這樣規模的專案，**不需要 Stripe 規模的基礎設施**，就能透過幾個簡單腳本實現這個工作流程的核心價值——讓 CI 自己嘗試修複，超過 2 輪才交給人工，大幅降低重複性修復工作。

---

## 實際實作決策

> 本節記錄將 Stripe Minions 概念落地到 FurFriend Finder 時的具體決策。
> 詳細策略文件請見：[AI 自動化開發工作流程策略](./ai-workflow-strategy.md)

### 關鍵決策摘要

| 決策 | 結論 |
|------|------|
| 認證 | 本地用 Max 訂閱，CI 另申請 `ANTHROPIC_API_KEY` |
| 費用 | Haiku $0.01–0.03/PR，Sonnet $0.10–0.35/PR |
| 重試上限 | `--max-turns 2`（對應 Stripe 的 2 輪 CI）|
| 工作流 | Issue → claude-plan label → AI 出計劃 → approved → AI 實作 → PR |
| Token 控制 | `.claudeignore` + 精確任務描述 + `CLAUDE.md` 限制 |

### 實作的檔案

- **`.claudeignore`** — 防止讀取 node_modules 等大型無關檔案
- **`CLAUDE.md`** — AI 行為邊界（每次任務上限 3 個檔案、描述不清楚時詢問）
- **`scripts/minion.sh`** — 本地驗證腳本，可用 `DRY_RUN=1` 測試

### 快速開始

```bash
# 本地測試（需要 Claude Max 訂閱）
./scripts/minion.sh "在 src/__test__/unit/service/animalLost.service.test.ts 補充 found_place 空字串的測試"

# 乾跑模式（不實際執行，只驗證設定）
DRY_RUN=1 ./scripts/minion.sh "任務描述測試"
```
