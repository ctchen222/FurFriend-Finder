# Reliable Dev Automatic Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每次通過 CI 並合併到 `dev` 的可部署變更，自動建置 immutable GHCR image、更新 VPS 上的 app/worker、持久化實際 digest，並留下可診斷與可回退的部署證據。

**Architecture:** 現有 `.github/workflows/deploy-image.yml` 已經能在 `dev` push 後 build image 並透過 SSH 呼叫 `/usr/local/sbin/furfriend-deploy`；PR 61 的 run `34338903327` 也已成功執行 build 與 deploy。這份變更不重建 CD，而是把 image/deploy jobs 接到同一個 CI dependency graph，並強化 VPS script 的 host lock、release metadata、精確 image 驗證、失敗診斷與相容 rollback。Compose 繼續以同一 immutable digest 啟動 app、worker、migrate；PostgreSQL schema 不自動降版。

**Tech Stack:** GitHub Actions、GHCR、Docker Compose 2.40、Bash、SSH、Cloudflare Tunnel、Node.js 22、pnpm。

## Global Constraints

- 實作從最新 `dev` 建立新分支，PR 只對 `dev`；不得直接 push `dev` 或 `main`，不得自動 merge。
- 本階段只部署 GitHub Environment `development` 與 Compose project `furfriend-dev`；不得建立或部署 production。
- 使用 GHCR 回傳的 `sha256:<64 hex>` digest；不得部署 `latest` 或只靠 mutable tag。
- app、worker 與 migrate 必須使用同一 digest；PostgreSQL、Mailpit 與 Cloudflare Tunnel 不因 app release 被重建。
- migration 必須先於 app/worker rollout；migration 失敗時保留舊 app/worker。資料庫 migration 不自動降版。
- `/etc/furfriend/dev.env` 與 Tunnel token 不得輸出至 GitHub logs；失敗診斷只輸出 Compose 狀態與 app/worker/cloudflared 的 bounded logs。
- GitHub Secrets 維持 `DEV_DEPLOY_HOST`、`DEV_DEPLOY_USER`、`DEV_SSH_PRIVATE_KEY`、`DEV_SSH_KNOWN_HOSTS`；SSH 只可執行 root-owned 固定 scripts。
- 維持既有 K3s/Zeabur、80/443 owner、Cloudflare Tunnel 與資料 volume，不清空或重建主機。
- deploy script CLI 保持 `furfriend-deploy dev sha256:<digest>`，確保 workflow 與 VPS script 可分階段上線。

## Current State and Root Cause

```text
PR 61 merged to dev (a81dce3)
        |
        +--> CI: success
        +--> GHCR image build: success
        +--> SSH deploy: success
                 |
                 +--> app/worker run sha256:062c1f04...
                 +--> /etc/furfriend/dev.env still says sha256:06a8ca24...
```

`deploy/scripts/deploy.sh` 目前只用 `export IMAGE_DIGEST="$image_digest"` 覆蓋當次 Compose process，成功後沒有持久化 digest。容器因此已更新，但後續直接使用 `dev.env` 執行 Compose 時仍會解析成舊 image。另一個缺口是 `CI` 與 `Build and Deploy Dev Image` 同時由 `push dev` 觸發，deploy job 不等待該 merge commit 的 `CI status gate`。

## File Map

| File | Responsibility |
| --- | --- |
| `deploy/scripts/lib/release-state.sh` | 驗證、讀取與原子持久化 current/previous digest，不輸出 env secrets；VPS 安裝於 `/usr/local/lib/furfriend/release-state.sh` |
| `deploy/scripts/tests/release-state.test.sh` | 在 temporary directory 驗證 digest validation、atomic update 與 permissions |
| `deploy/scripts/deploy.sh` | host lock、migration、rollout、image assertion、成功後 persist、失敗診斷 |
| `deploy/scripts/rollback.sh` | 使用相同 lock 回到指定相容 digest，成功後更新 release state |
| `deploy/scripts/status.sh` | 安全輸出目前設定／執行中 digest、Compose ps 與 bounded service logs |
| `.github/workflows/ci.yml` | CI gate 後 build GHCR digest、SSH deploy、public smoke 與 failure diagnostics |
| `.github/workflows/deploy-image.yml` | 完成整併後刪除，避免同一 push 重複部署 |
| `deploy/runbooks/vps-docker-dev.md` | 一次性 host script 安裝、日常觀察、rollback 與故障排查 |
| `docs/vps-deployment-plan.md` | 將過時的「尚未部署」敘述改為 current state 與剩餘缺口 |

---

### Task 1: Test and persist successful release state

**Files:**
- Create: `deploy/scripts/lib/release-state.sh`
- Create: `deploy/scripts/tests/release-state.test.sh`
- Modify: `deploy/scripts/deploy.sh`
- Modify: `deploy/scripts/rollback.sh`

**Interfaces:**
- Produces: `validate_digest(value): exit 0|2`，只接受 `sha256:[0-9a-f]{64}`。
- Produces: `read_env_digest(path): stdout digest`，只讀唯一的 `IMAGE_DIGEST=`。
- Produces: `persist_env_digest(path, digest): atomic replacement`，保留 owner/group/mode。
- Preserves: `furfriend-deploy dev <digest>` 與 `furfriend-rollback dev <digest>` CLI。

- [ ] **Step 1: Write RED release-state tests**

建立 self-contained Bash test，使用 `mktemp -d` 與 trap cleanup。測試必須覆蓋：拒絕 tag／大寫 digest／長度錯誤、讀取 current digest、只替換 anchored `IMAGE_DIGEST=`、不改其他 env lines、寫入後仍為 mode `0600`。

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/release-state.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
env_file="$tmp_dir/dev.env"
old="sha256:$(printf 'a%.0s' {1..64})"
new="sha256:$(printf 'b%.0s' {1..64})"

printf 'IMAGE_REPOSITORY=ghcr.io/ctchen222/furfriend-finder\nIMAGE_DIGEST=%s\nNODE_ENV=production\n' "$old" > "$env_file"
chmod 600 "$env_file"

validate_digest "$new"
! validate_digest latest
[[ "$(read_env_digest "$env_file")" == "$old" ]]
persist_env_digest "$env_file" "$new"
[[ "$(read_env_digest "$env_file")" == "$new" ]]
[[ "$(stat -c '%a' "$env_file")" == "600" ]]
grep -qx 'NODE_ENV=production' "$env_file"
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
bash deploy/scripts/tests/release-state.test.sh
```

Expected: FAIL because `deploy/scripts/lib/release-state.sh` does not exist.

- [ ] **Step 3: Implement the release-state helper**

The helper must use a same-directory temporary file so `mv` is atomic on the same filesystem. It must preserve ownership and mode before replacing the file, and never print file contents.

```bash
validate_digest() {
  [[ "${1:-}" =~ ^sha256:[0-9a-f]{64}$ ]]
}

read_env_digest() {
  local file="$1" value
  value="$(sed -n 's/^IMAGE_DIGEST=//p' "$file")"
  [[ "$(printf '%s\n' "$value" | wc -l | tr -d ' ')" == "1" ]]
  validate_digest "$value"
  printf '%s\n' "$value"
}

persist_env_digest() {
  local file="$1" digest="$2" tmp
  validate_digest "$digest"
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  trap 'rm -f "$tmp"' RETURN
  awk -v digest="$digest" '
    BEGIN { replaced = 0 }
    /^IMAGE_DIGEST=/ { print "IMAGE_DIGEST=" digest; replaced++; next }
    { print }
    END { if (replaced != 1) exit 42 }
  ' "$file" > "$tmp"
  chown --reference="$file" "$tmp"
  chmod --reference="$file" "$tmp"
  mv -f "$tmp" "$file"
  trap - RETURN
}
```

- [ ] **Step 4: Persist only after successful rollout**

In `deploy.sh`, read and validate `previous_digest` before deployment. Add a host-level lock before any Compose mutation:

```bash
exec 9>/run/lock/furfriend-dev-deploy.lock
flock -n 9 || {
  echo "Another FurFriend dev deployment is active." >&2
  exit 75
}

previous_digest="$(read_env_digest "$env_file")"
```

After `docker compose up -d --wait`, require both containers to reference the requested repository@digest, then persist:

```bash
expected_image="${IMAGE_REPOSITORY}@${image_digest}"
for service in app worker; do
  container_id="$("${compose[@]}" "${compose_args[@]}" ps -q "$service")"
  [[ -n "$container_id" ]]
  [[ "$(docker inspect --format '{{.Config.Image}}' "$container_id")" == "$expected_image" ]]
done

install -d -m 700 /var/lib/furfriend/dev
printf '%s\n' "$previous_digest" > /var/lib/furfriend/dev/previous-digest
chmod 600 /var/lib/furfriend/dev/previous-digest
persist_env_digest "$env_file" "$image_digest"
```

Do not persist if pull, migration, Compose health, or exact image assertion fails.

- [ ] **Step 5: Make rollback update the same state**

`rollback.sh` must acquire the same lock, read the current digest, update app/worker using the explicitly supplied target, assert exact image references, then atomically persist the target and write the former current digest to `previous-digest`. It must not execute a down migration.

- [ ] **Step 6: Verify Task 1**

Run:

```bash
bash -n deploy/scripts/lib/release-state.sh deploy/scripts/deploy.sh deploy/scripts/rollback.sh
bash deploy/scripts/tests/release-state.test.sh
pnpm lint
pnpm type-check
```

Expected: all commands exit 0; no secret values appear.

Commit: `fix(deploy): persist successful dev image digest`

---

### Task 2: Add safe deployment status and bounded failure evidence

**Files:**
- Create: `deploy/scripts/status.sh`
- Modify: `deploy/scripts/deploy.sh`
- Modify: `deploy/scripts/tests/release-state.test.sh`
- Modify: `deploy/runbooks/vps-docker-dev.md`

**Interfaces:**
- Produces: `furfriend-status dev [--logs <1..500>]`.
- Output permits: configured digest, app/worker `.Config.Image`, container state/health, bounded app/worker/cloudflared logs.
- Output forbids: `docker compose config`, `docker inspect .Config.Env`, `/etc/furfriend/dev.env` contents, Tunnel token contents.

- [ ] **Step 1: Add RED CLI validation tests**

Add tests requiring environment other than `dev`, zero, negative, non-numeric, and values above 500 to exit 2. `--logs 120` must be accepted.

- [ ] **Step 2: Implement status output through fixed commands**

Use the same fixed Compose files and project name. Print only:

```bash
printf 'configured_digest=%s\n' "$(read_env_digest "$env_file")"
"${compose[@]}" "${compose_args[@]}" ps
for service in app worker; do
  id="$("${compose[@]}" "${compose_args[@]}" ps -q "$service")"
  docker inspect --format '{{.Name}} image={{.Config.Image}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id"
done
"${compose[@]}" "${compose_args[@]}" logs --no-color --tail "$log_lines" app worker cloudflared
```

- [ ] **Step 3: Emit diagnostics when deploy fails**

Add an `ERR` trap to `deploy.sh` that captures the failing line/exit code and invokes status with a bounded tail. It must not call `docker compose config`.

```bash
on_error() {
  local code=$? line=${BASH_LINENO[0]:-unknown}
  echo "Dev deployment failed at line $line with exit $code." >&2
  /usr/local/sbin/furfriend-status dev --logs 120 >&2 || true
  exit "$code"
}
trap on_error ERR
```

- [ ] **Step 4: Verify Task 2**

Run:

```bash
bash -n deploy/scripts/status.sh deploy/scripts/deploy.sh
bash deploy/scripts/tests/release-state.test.sh
rg -n 'compose config|Config.Env|cat .*dev.env|tunnel-token' deploy/scripts/status.sh
```

Expected: syntax/tests pass; the forbidden-output scan returns no matches.

Commit: `feat(deploy): expose safe dev deployment diagnostics`

---

### Checkpoint A: Install hardened host scripts once

Repository changes do not automatically replace root-owned files under `/usr/local/sbin`. Before enabling the updated workflow, copy the reviewed scripts and `deploy/scripts/lib/release-state.sh` to the VPS using a temporary directory, compare SHA-256, then install as `root:root 0755` under `/usr/local/sbin` and `/usr/local/lib/furfriend`. This is a one-time infrastructure rollout; ordinary future app releases remain automatic.

Required VPS verification:

```bash
sudo bash -n /usr/local/sbin/furfriend-deploy /usr/local/sbin/furfriend-rollback /usr/local/sbin/furfriend-status
sudo bash -n /usr/local/lib/furfriend/release-state.sh
sudo stat -c '%U:%G %a %n' /usr/local/sbin/furfriend-deploy /usr/local/sbin/furfriend-rollback /usr/local/sbin/furfriend-status
sudo /usr/local/sbin/furfriend-status dev --logs 20
```

Expected: scripts are `root:root 755`; configured and running app/worker digests agree; status output contains no env secrets.

---

### Task 3: Gate image build and deployment on the exact CI run

**Files:**
- Modify: `.github/workflows/ci.yml`
- Delete: `.github/workflows/deploy-image.yml`

**Interfaces:**
- Consumes: `changes` outputs and `status-gate` result for the current `github.sha`.
- Produces: `image_repository` and `image_digest` job outputs.
- Deploys only when `github.event_name == 'push'`, `github.ref == 'refs/heads/dev'`, CI passed, and app/deploy runtime paths changed.

- [ ] **Step 1: Extend changed-path coverage**

Ensure the deployable-app filter includes all Docker build inputs: `src/**`, `web/**`, `views/**`, `sql/**`, `Dockerfile`, `.dockerignore`, `package.json`, both lockfiles used by the Docker build, TypeScript config, and shared GitHub setup action. Keep Compose/scripts/workflow under the deploy filter.

- [ ] **Step 2: Move immutable image job behind `status-gate`**

Move the existing Buildx/GHCR job into `ci.yml`. Its dependency and condition must be explicit:

```yaml
  image:
    name: Build and publish immutable dev image
    needs: [changes, status-gate]
    if: >-
      github.event_name == 'push' &&
      github.ref == 'refs/heads/dev' &&
      needs['status-gate'].result == 'success' &&
      (needs.changes.outputs.app == 'true' || needs.changes.outputs.deploy == 'true')
```

Continue using `docker/build-push-action@v6`, `platforms: linux/amd64`, tag `${{ github.sha }}`, and `steps.build.outputs.digest` for deployment.

- [ ] **Step 3: Move the deployment job after the image job**

Keep `environment.name: development`, the existing four SSH secrets, strict known-host checking, and the fixed command:

```yaml
"sudo /usr/local/sbin/furfriend-deploy dev '${IMAGE_DIGEST}'"
```

Add a post-deploy public smoke with bounded retries:

```yaml
      - name: Verify public dev health
        run: >-
          curl --fail --silent --show-error
          --retry 6 --retry-delay 5 --retry-all-errors
          https://dev.furfriend-finder.com/health
```

- [ ] **Step 4: Prevent cancellation during a VPS mutation**

Change workflow concurrency so PR checks may be cancelled by a newer PR commit, but a `push` deployment is queued rather than cancelled:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

The host `flock` from Task 1 remains the second protection against manual/parallel deploys.

- [ ] **Step 5: Add failure-only remote diagnostics**

After the deploy/smoke steps, invoke the fixed safe status script only on failure:

```yaml
      - name: Collect bounded deployment diagnostics
        if: failure()
        run: >-
          ssh
          -i "$RUNNER_TEMP/ssh/deploy_key"
          -o IdentitiesOnly=yes
          -o StrictHostKeyChecking=yes
          -o UserKnownHostsFile="$RUNNER_TEMP/ssh/known_hosts"
          "$DEPLOY_USER@$DEPLOY_HOST"
          "sudo /usr/local/sbin/furfriend-status dev --logs 120"
```

- [ ] **Step 6: Remove the duplicate workflow and validate YAML**

Delete `.github/workflows/deploy-image.yml` only after the jobs exist in `ci.yml`; otherwise one merge would deploy twice or not at all.

Run:

```bash
pnpm lint
pnpm type-check
bash deploy/scripts/tests/release-state.test.sh
docker compose --env-file deploy/compose/env.dev.example -f deploy/compose/compose.yaml -f deploy/compose/compose.dev.yaml config --quiet
```

Expected: all commands exit 0. On a PR event, image/deploy are skipped. On a `dev` push, image waits for `CI status gate` and only one deploy job exists.

Commit: `feat(ci): gate dev deployment on successful checks`

---

### Task 4: Document rollout, observation, and rollback

**Files:**
- Modify: `deploy/runbooks/vps-docker-dev.md`
- Modify: `docs/vps-deployment-plan.md`

**Interfaces:**
- Documents: source SHA -> workflow run -> GHCR digest -> configured digest -> app/worker image reference.
- Documents: one-time host script installation separately from recurring automatic app deployment.

- [ ] **Step 1: Replace stale deployment status**

Update `docs/vps-deployment-plan.md` so it no longer says Docker/Tunnel/secrets/app deployment have not happened. Record only verified facts: dev Compose is live, Cloudflare Tunnel serves the dev hostname, PR 61 automatic deploy succeeded, and production remains disabled.

- [ ] **Step 2: Add daily observation commands**

Document:

```bash
gh run list --workflow ci.yml --branch dev --limit 5
sudo /usr/local/sbin/furfriend-status dev --logs 100
sudo docker images --digests ghcr.io/ctchen222/furfriend-finder
curl -fsS https://dev.furfriend-finder.com/health
```

Explain that app and worker intentionally share one image digest and differ by command.

- [ ] **Step 3: Add explicit rollback decision boundary**

Document that a migration failure leaves the prior app running; a post-rollout failure may return app/worker to `previous-digest` only when migrations follow the additive expand/contract rule. Never auto-downgrade PostgreSQL schema.

- [ ] **Step 4: Run final repository verification**

Run:

```bash
pnpm lint
pnpm type-check
pnpm exec jest --runInBand --testPathPattern='src/__test__/unit' --testPathIgnorePatterns='/node_modules/|/dist/|e2e'
bash deploy/scripts/tests/release-state.test.sh
bash -n deploy/scripts/lib/release-state.sh deploy/scripts/deploy.sh deploy/scripts/rollback.sh deploy/scripts/status.sh
```

Expected: lint/type-check pass; 56 unit suites and 376 tests or the updated greater count pass; shell tests and syntax checks pass.

Commit: `docs(deploy): document reliable dev release flow`

---

## End-to-End Acceptance

After the implementation PR is reviewed and merged to `dev`:

```text
merge dev
  -> CI status gate passes for the same SHA
  -> GHCR returns immutable digest
  -> one SSH deployment acquires host lock
  -> PostgreSQL migration succeeds
  -> app + worker use repository@that-digest
  -> Compose health and public /health pass
  -> /etc/furfriend/dev.env persists that digest
  -> GitHub Environment records success
```

Acceptance checks:

- A successful app change automatically updates both app and worker without a manual SSH deploy.
- `read_env_digest /etc/furfriend/dev.env`, app `.Config.Image`, worker `.Config.Image`, and workflow output all identify the same digest.
- A migration failure does not replace app/worker and does not persist the failed digest.
- A concurrent manual deploy exits 75 while another deployment holds the host lock.
- Failure logs are bounded and contain no application env, SSH key, database URL, OAuth secret, Threads token, or Tunnel token.
- Documentation-only changes that do not affect build/deploy inputs do not publish or deploy a redundant image.
- No workflow deploys `main`, creates production resources, pushes to protected branches, or merges a PR.

## GitHub Environment Setting

In `Settings -> Environments -> development`, set deployment branches to `Selected branches and tags` and allow only branch `dev`. Keep the four SSH values as Environment secrets so only the deploy job can access them. GitHub documents that Environment protection rules run before the job receives Environment secrets, and concurrency limits one deployment group at a time.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| CI deploys before exact merge-SHA tests finish | Broken dev release | Put image/deploy behind `status-gate` in the same workflow |
| Container updated but env retains old digest | Restart or manual Compose can regress | Persist only after exact image + health verification |
| Two deploys mutate Compose concurrently | Old release can overwrite new release | GitHub concurrency plus VPS `flock` |
| Migration succeeds but new app is unhealthy | App rollback may be schema-incompatible | Additive expand/contract migrations; never auto-downgrade DB |
| Diagnostic command leaks secrets | Credential compromise | Fixed status script; never print Compose config or container env |
| Repo script and `/usr/local/sbin` drift | CI behavior differs from reviewed source | One-time hash-verified root install; document installed script version |

## Official References

- [GitHub workflow syntax: `jobs.<job_id>.needs`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds)
- [GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments)
- [GitHub deployment controls and concurrency](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [GitHub managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
