<script lang="ts">
  // 시작 화면 - 최근 작품, 폴더 열기, 새 작품. 조용한 목록형 (히어로 카드 금지).
  import { onMount } from 'svelte';
  import { bridge } from '$lib/bridge';
  import {
    cancelPendingProjectOpen, createProjectAt, forgetRecentProject,
    openProjectByPath, recentProjects, toast
  } from '$lib/stores/app';

  let { bridgeKind }: { bridgeKind: string } = $props();

  let recents = $state<string[]>([]);
  let openPath = $state('');
  let base = $state('');
  let title = $state('');
  let author = $state('');
  let opening = $state(false);
  let creating = $state(false);
  const working = $derived(opening || creating);

  onMount(async () => {
    recents = recentProjects();
    try {
      const env = await bridge().env();
      base = `${env.home}/Documents/Bindery`;
    } catch {
      base = '/tmp/bindery';
    }
  });

  async function open(path: string) {
    if (!path.trim()) return;
    opening = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // 파일 접근이 OS 권한(예: macOS의 문서 폴더 접근 차단)으로 응답 없이 매달릴 수
      // 있다 - marker 확인부터 실제 열기까지 전체 요청에 timeout을 건다.
      await Promise.race([
        (async () => {
          const marker = await bridge().exists(path.trim(), 'project.yaml').catch(() => false);
          if (!marker && !confirm('project.yaml이 없는 폴더입니다. 일반 폴더를 Bindery 프로젝트로 열까요?')) return;
          await openProjectByPath(path.trim());
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            cancelPendingProjectOpen();
            reject(new Error('폴더 응답이 없습니다. macOS 폴더 접근 권한(문서/데스크톱)을 확인하거나 다른 위치의 폴더를 열어보세요.'));
          }, 15_000);
        })
      ]);
    } catch (err) {
      toast(`열기 실패: ${err instanceof Error ? err.message : String(err)}`, 'bad');
    } finally {
      if (timer) clearTimeout(timer);
      opening = false;
    }
  }

  async function chooseFolder(target: 'open' | 'base') {
    const result = await bridge().pickFolder?.(target === 'open' ? '열 작품 폴더를 선택하세요' : '새 작품을 저장할 폴더를 선택하세요');
    if (!result || result.cancelled || !result.path) return;
    if (target === 'base') base = result.path;
    else {
      openPath = result.path;
      await open(result.path);
    }
  }

  function removeRecent(path: string) {
    forgetRecentProject(path);
    recents = recentProjects();
  }

  async function create() {
    if (!title.trim()) {
      toast('작품 제목을 입력하세요', 'warn');
      return;
    }
    creating = true;
    try {
      await createProjectAt(base.trim(), title.trim(), author.trim());
    } catch (err) {
      toast(`생성 실패: ${err instanceof Error ? err.message : String(err)}`, 'bad');
    } finally {
      creating = false;
    }
  }
</script>

<main class="picker">
  <header class="intro">
    <h1>Bindery</h1>
    <p>장편 집필의 기획, 원고, 검토, 정사를 한 프로젝트 안에서 이어갑니다.</p>
    <dl>
      <div><dt>저장</dt><dd>로컬 Markdown</dd></div>
      <div><dt>실행</dt><dd>CLI 연결 또는 오프라인</dd></div>
      <div><dt>복구</dt><dd>스냅샷과 백업</dd></div>
    </dl>
    {#if bridgeKind === 'memory'}
      <p class="notice">브라우저 데모 모드입니다. 파일이 디스크에 저장되지 않습니다. <code>npm run dev</code>로 실행하세요.</p>
    {/if}
  </header>

  <section class="col recent-panel" aria-labelledby="recent-title">
    <div class="section-head">
      <h2 id="recent-title">최근 작품</h2>
      <span>{recents.length}개</span>
    </div>
    {#if recents.length === 0}
      <p class="empty">최근 작품이 없습니다.</p>
    {:else}
      <ul class="recent">
        {#each recents as r}
          <li>
            <button class="quiet recent-path" onclick={() => open(r)} disabled={working} title={r}>{r}</button>
            <button class="quiet recent-remove" onclick={() => removeRecent(r)} disabled={working} aria-label={`${r} 최근 목록에서 제거`}>제거</button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="open-panel">
      <label for="project-open-path">다른 폴더 열기</label>
      <div class="row">
      <input id="project-open-path" bind:value={openPath} placeholder="/절대/경로/작품폴더" onkeydown={(e) => e.key === 'Enter' && open(openPath)} />
      {#if bridgeKind === 'tauri'}<button onclick={() => chooseFolder('open')} disabled={working}>폴더 선택</button>{/if}
      <button onclick={() => open(openPath)} disabled={working}>{opening ? '여는 중...' : '열기'}</button>
      </div>
    </div>
  </section>

  <section class="col create-panel" aria-labelledby="create-title">
    <div class="section-head">
      <h2 id="create-title">새 작품</h2>
      <span>프로젝트 만들기</span>
    </div>
    <form class="form" onsubmit={(event) => { event.preventDefault(); void create(); }}>
      <label>저장 위치
        <span class="row"><input bind:value={base} />{#if bridgeKind === 'tauri'}<button type="button" onclick={() => chooseFolder('base')} disabled={working}>선택</button>{/if}</span>
      </label>
      <label>작품 제목<input bind:value={title} placeholder="무제여도 됩니다" /></label>
      <label>작가명<input bind:value={author} /></label>
      <button class="primary" type="submit" disabled={working}>{creating ? '생성 중...' : '작품 폴더 만들기'}</button>
      <p class="dim">ideas, canon, characters, world, plot, story 구조를 만들고 소재 발굴부터 시작합니다.</p>
    </form>
  </section>
</main>

<style>
  .picker {
    min-height: 100%; display: grid; grid-template-columns: 224px minmax(300px, 1fr) minmax(320px, 380px); gap: var(--space-7);
    width: min(100%, var(--content-wide)); margin: 0 auto; padding: 64px var(--space-7); align-content: start;
  }
  .intro { display: grid; gap: var(--space-3); align-content: start; padding-right: var(--space-5); border-right: 1px solid var(--line-strong); }
  h1 { color: var(--accent); font-size: 28px; margin: 0; }
  .intro > p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .intro dl { margin: var(--space-3) 0 0; border-top: 1px solid var(--line); }
  .intro dl > div { display: grid; gap: var(--space-1); padding: var(--space-2) 0; border-bottom: 1px solid var(--line); }
  .intro dt { color: var(--faint); font-size: 10px; font-weight: 800; }
  .intro dd { margin: 0; color: var(--text); font-size: 11.5px; }
  .col { display: grid; gap: 8px; align-content: start; }
  .col, .recent, .form { min-width: 0; }
  .section-head { min-height: 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line-strong); }
  .section-head h2 { margin: 0; font-size: 16px; }
  .section-head span { color: var(--faint); font-size: 10.5px; }
  .recent { list-style: none; margin: 0; padding: 0; }
  .recent li { display: flex; gap: var(--space-2); align-items: center; border-bottom: 1px solid var(--line); }
  .recent-path {
    flex: 1; min-width: 0; text-align: left; font-family: var(--mono); font-size: 12px; padding: 8px 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .recent-remove { flex: 0 0 auto; color: var(--faint); font-size: 11px; }
  .row { display: flex; gap: 8px; min-width: 0; }
  .row input { flex: 1; min-width: 0; }
  .open-panel { display: grid; gap: var(--space-1); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--line); }
  .open-panel > label { color: var(--muted); font-size: 11.5px; }
  .form { display: grid; gap: var(--space-3); padding-top: var(--space-1); }
  .form input { min-width: 0; width: 100%; }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .notice { font-size: 12px; color: var(--warn); background: var(--warn-soft); padding: 8px 8px; border-radius: 4px; }
  @media (max-width: 1040px) {
    .picker { grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); padding-top: var(--space-7); }
    .intro { grid-column: 1 / -1; grid-template-columns: 180px minmax(0, 1fr); align-items: start; padding: 0 0 var(--space-4); border-right: 0; border-bottom: 1px solid var(--line-strong); }
    .intro dl { grid-column: 2; grid-row: 1 / span 2; margin: 0; }
  }
  @media (max-width: 720px) {
    .picker { grid-template-columns: minmax(0, 1fr); padding: var(--space-6) var(--space-3); }
    .intro { display: grid; grid-template-columns: minmax(0, 1fr); }
    .intro dl { grid-column: 1; grid-row: auto; }
  }
</style>
