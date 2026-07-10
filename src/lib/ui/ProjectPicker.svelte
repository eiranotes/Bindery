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

<div class="picker">
  <div class="col">
    <h1>Bindery</h1>
    <p class="dim">AI 장기 소설 집필 하네스 - 모든 산출물은 로컬 Markdown 파일로 남습니다.</p>
    {#if bridgeKind === 'memory'}
      <p class="notice">브라우저 데모 모드입니다. 파일이 디스크에 저장되지 않습니다. <code>npm run dev</code>로 실행하세요.</p>
    {/if}

    <span class="label">최근 작품</span>
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

    <span class="label">폴더 열기</span>
    <div class="row">
      <input bind:value={openPath} placeholder="/절대/경로/작품폴더" onkeydown={(e) => e.key === 'Enter' && open(openPath)} />
      {#if bridgeKind === 'tauri'}<button onclick={() => chooseFolder('open')} disabled={working}>폴더 선택</button>{/if}
      <button onclick={() => open(openPath)} disabled={working}>{opening ? '여는 중...' : '열기'}</button>
    </div>
  </div>

  <div class="col">
    <span class="label">새 작품</span>
    <div class="form">
      <label>저장 위치
        <span class="row"><input bind:value={base} />{#if bridgeKind === 'tauri'}<button type="button" onclick={() => chooseFolder('base')} disabled={working}>선택</button>{/if}</span>
      </label>
      <label>작품 제목<input bind:value={title} placeholder="무제여도 됩니다" /></label>
      <label>작가명<input bind:value={author} /></label>
      <button class="primary" onclick={create} disabled={working}>{creating ? '생성 중...' : '작품 폴더 만들기'}</button>
      <p class="dim">ideas/ · canon/ · characters/ · world/ · plot/ · story/ 구조가 생성되고, 소재 발굴부터 시작합니다.</p>
    </div>
  </div>
</div>

<style>
  .picker {
    height: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
    max-width: 880px; margin: 0 auto; padding: 72px 32px; align-content: start;
  }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .col { display: grid; gap: 8px; align-content: start; }
  .col, .recent, .form { min-width: 0; }
  .recent { list-style: none; margin: 0; padding: 0; }
  .recent li { display: flex; gap: var(--space-2); align-items: center; border-bottom: 1px solid var(--line); }
  .recent-path {
    flex: 1; min-width: 0; text-align: left; font-family: var(--mono); font-size: 12px; padding: 8px 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .recent-remove { flex: 0 0 auto; color: var(--faint); font-size: 11px; }
  .row { display: flex; gap: 8px; min-width: 0; }
  .row input { flex: 1; min-width: 0; }
  .form { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .form input { min-width: 0; width: 100%; }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .notice { font-size: 12px; color: var(--warn); background: var(--warn-soft); padding: 8px 8px; border-radius: 4px; }
  @media (max-width: 760px) { .picker { grid-template-columns: 1fr; padding: 32px 20px; } }
</style>
