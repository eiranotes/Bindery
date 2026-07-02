# 01. 모노레포 구조 + 기술스택

## 1. 기술스택 확정

전제 스택을 그대로 채택하되, 두 지점만 근거를 붙여 확정한다(그 외는 전제 유지).

### 1.1 상태관리: Svelte 5 Runes + stores (확정)

| 선택지 | 장점 | 단점 | 결론 |
|---|---|---|---|
| **Svelte 5 runes + stores** | SvelteKit 네이티브, 번들 최소, 러너 친화, derived 자연스러움 | 러너 학습곡선 | **채택** |
| nanostores | 프레임워크 중립, 가벼움 | Svelte 통합 이점 없음, 이중 추상 | 미채택 |
| Zustand류 | React 생태계 표준 | Svelte에 부적합 | 미채택 |

결론: `$state`/`$derived`/`$effect`(Svelte 5) 중심, 크로스컴포넌트 공유는 `$lib/stores/*.svelte.ts`의 러너 기반 store로 통일. (문서상 store 이름은 `05_store_design.md` 유지)

### 1.2 Diff 에디터: CodeMirror Merge (본문) + Monaco(설정, 선택)

| 선택지 | 장점 | 단점 | 결론 |
|---|---|---|---|
| **CodeMirror Merge** | 본문 에디터와 동일 엔진, 번들 절감, 한글/데코 일관 | 3-way merge 약함 | **본문 diff 채택** |
| Monaco Diff | JSON/YAML diff 강력, VS Code UX | 무거움, 본문에 과함 | **설정/스키마 diff에만 선택 채택** |

결론: 원고 diff는 CodeMirror Merge, `config.yaml`/agent md/JSON diff는 Monaco 선택 로드. hunk 단위 apply는 diff-match-patch 보조.

### 1.3 나머지(전제 그대로 확정)

Tauri 2 / SvelteKit+TS / CodeMirror 6 / Rust Tauri commands / Python novelctl / Gemini CLI subprocess / Markdown·YAML·JSON / SQLite(rusqlite) / Git+snapshots / pnpm / pyproject.toml(uv) / Vitest·Playwright·cargo test·pytest.

- SQLite 접근: Rust는 `rusqlite`(동기, 단순), Python은 표준 `sqlite3`. 인덱스 쓰기는 **novelctl 소유**(단일 writer 원칙), Rust는 읽기 위주 + UI 캐시.
- Markdown 렌더: 프론트는 `markdown-it`(가벼움, wiki link 플러그인 용이). remark 계열은 v2 리치뷰 때 재검토.

## 2. 모노레포 구조

```text
novel-studio/
  package.json                # pnpm workspace root
  pnpm-workspace.yaml
  Cargo.toml                  # (workspace 미사용 시 apps/desktop/src-tauri 내부)
  apps/
    desktop/                  # Tauri + SvelteKit 앱
      package.json
      svelte.config.js
      vite.config.ts
      src/                    # SvelteKit 프론트
        routes/
        lib/
          api/                # Tauri invoke 래퍼(유일한 invoke 지점)
          stores/
          components/
          workers/            # repetition/markdown parse worker
      src-tauri/              # Rust
        Cargo.toml
        tauri.conf.json
        src/
          main.rs
          commands/           # command 모듈(파일별)
          fs/                 # path sandbox, watcher
          proc/               # novelctl/gemini subprocess runner
          snapshot/
          git/
          index/              # sqlite read
          error.rs
      tests/                  # playwright e2e
  packages/
    novelctl-core/            # Python 도메인 코어(=AI runner + 분석 + 파이프라인)
      pyproject.toml
      novelctl/
        __init__.py
        cli.py                # argparse/typer 엔트리(--json)
        contracts/            # 공통 응답/에러 스키마(파이썬측)
        pipeline/             # context/draft/summary/canon/qa/revise/commit
        analysis/             # repetition/rhythm/mention(로컬)
        agents/               # gemini cli 호출 래퍼
        snapshot.py
        integrity.py
        commit_journal.py
        indexer.py            # sqlite write(단일 writer)
      tests/                  # pytest
    shared-schemas/           # 단일 진실원 스키마(양측이 생성 소비)
      json/                   # *.schema.json (기존 schemas/ 이관)
      ts/                     # 생성된 d.ts (json-schema-to-typescript)
      py/                     # 생성된 pydantic models (datamodel-code-generator)
      package.json            # 스키마→타입 생성 스크립트
    project-template/         # 신규 프로젝트 스캐폴드(기존 templates/project-template 이관)
  docs/                       # 설계 문서(기존 유지) + 22_design_review.md
  implementation_plan/        # 본 폴더
  scripts/
    gen-types.mjs             # shared-schemas json → ts/py 생성
    dev.sh                    # pnpm --filter desktop tauri dev + uv run
    build-release.sh
    bundle-novelctl.sh        # v1: pyinstaller/briefcase
```

## 3. 디렉터리별 역할 · 주요 파일 · 빌드 · 의존성

| 디렉터리 | 역할 | 주요 파일 | 빌드 | 의존성 |
|---|---|---|---|---|
| `apps/desktop/src` | SvelteKit 프론트(표시·상호작용) | `lib/api/commands.ts`, `lib/stores/*`, `lib/components/*` | `pnpm --filter desktop build` (vite/adapter-static) | shared-schemas(ts), CodeMirror6, markdown-it |
| `apps/desktop/src-tauri` | Rust 브리지(파일·프로세스·스냅샷·git·sqlite read) | `commands/*.rs`, `fs/sandbox.rs`, `proc/runner.rs` | `cargo build` → `tauri build` | tauri2, rusqlite, notify(watcher), serde, git2(optional) |
| `packages/novelctl-core` | 도메인 코어·AI runner·분석·인덱스 write | `cli.py`, `pipeline/*`, `analysis/*`, `agents/*` | `uv sync` / `uv build` | pydantic, pyyaml, kiwipiepy(optional), gemini-cli(외부) |
| `packages/shared-schemas` | 스키마 단일 진실원 → ts/py 생성 | `json/*.schema.json`, `scripts` | `pnpm --filter shared-schemas gen` | json-schema-to-typescript, datamodel-code-generator |
| `packages/project-template` | 신규 프로젝트 스캐폴드 | `.novelctl/config.yaml`, `.gemini/agents/*`, `story/...`, `context/`, `canon/facts/`, `notes/`, `exports/profiles/` | 없음(파일 복사) | 없음 |
| `docs` | 설계·리뷰 | `01~22_*.md` | 없음 | 없음 |
| `scripts` | 개발/빌드 자동화 | `gen-types.mjs`, `dev.sh` | 실행 스크립트 | node, uv |

## 4. 책임 경계(핵심)

```text
[SvelteKit]  표시·편집 상태·diff UI·candidate 미리보기        (도메인 로직 없음)
[Tauri/Rust] 파일 IO·path sandbox·watcher·subprocess·snapshot 복사·git·sqlite read
[novelctl]   파이프라인·context pack·분석·스키마 검증·commit journal·sqlite write(단일 writer)
[Gemini CLI] .gemini/agents/*.md 실행(원문 직접 write 안 함, candidate만)
[Files]      Markdown/YAML/JSON = source of truth
```

- 규칙 1: **프론트는 `invoke()`를 직접 호출하지 않는다.** 오직 `lib/api/commands.ts` 래퍼 경유.
- 규칙 2: **SQLite write는 novelctl만.** Rust/프론트는 read only → 인덱스 진실원 이원화 방지.
- 규칙 3: **AI 산출물은 `.novelctl/runs/<id>/`의 candidate로만.** apply는 GUI에서 diff 후 사용자 확정.
- 규칙 4: **path는 project root 상대경로만.** absolute·`..`·root밖 symlink 거부(Rust에서 MVP부터 강제).

## 5. 스키마 단일 진실원 파이프라인

```text
packages/shared-schemas/json/*.schema.json
   → (json-schema-to-typescript)  → apps/desktop 소비(ts)
   → (datamodel-code-generator)   → novelctl-core 소비(pydantic)
```

`pnpm gen:types`가 CI 선행 단계. 스키마 변경 시 양측 타입이 자동 동기 → GUI/CLI divergence(리뷰·19.4.1) 구조적 차단.
