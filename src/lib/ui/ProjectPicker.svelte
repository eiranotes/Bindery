<script lang="ts">
  // 시작 화면 - 최근 작품, 폴더 열기, 새 작품. 조용한 목록형 (히어로 카드 금지).
  import { onMount } from 'svelte';
  import { bridge } from '$lib/bridge';
  import { openProjectByPath, createProjectAt, recentProjects, toast } from '$lib/stores/app';

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
    try {
      // 파일 접근이 OS 권한(예: macOS의 문서 폴더 접근 차단)으로 응답 없이 매달릴 수
      // 있다 — 조용히 영원히 기다리지 않고 원인 후보와 함께 실패를 알린다.
      await Promise.race([
        openProjectByPath(path.trim()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('폴더 응답이 없습니다. macOS 폴더 접근 권한(문서/데스크톱)을 확인하거나 다른 위치의 폴더를 열어보세요.')), 15_000)
        )
      ]);
    } catch (err) {
      toast(`열기 실패: ${err instanceof Error ? err.message : String(err)}`, 'bad');
    } finally {
      opening = false;
    }
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
          <li><button class="quiet" onclick={() => open(r)} disabled={working}>{r}</button></li>
        {/each}
      </ul>
    {/if}

    <span class="label">폴더 열기</span>
    <div class="row">
      <input bind:value={openPath} placeholder="/절대/경로/작품폴더" onkeydown={(e) => e.key === 'Enter' && open(openPath)} />
      <button onclick={() => open(openPath)} disabled={working}>{opening ? '여는 중...' : '열기'}</button>
    </div>
  </div>

  <div class="col">
    <span class="label">새 작품</span>
    <div class="form">
      <label>저장 위치<input bind:value={base} /></label>
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
  .col { display: grid; gap: 10px; align-content: start; }
  .col, .recent, .form { min-width: 0; }
  .recent { list-style: none; margin: 0; padding: 0; }
  .recent li { border-bottom: 1px solid var(--line); }
  .recent button {
    width: 100%; text-align: left; font-family: var(--mono); font-size: 12px; padding: 7px 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row { display: flex; gap: 6px; min-width: 0; }
  .row input { flex: 1; min-width: 0; }
  .form { display: grid; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; }
  .form input { min-width: 0; width: 100%; }
  label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
  .notice { font-size: 12px; color: var(--warn); background: var(--warn-soft); padding: 6px 10px; border-radius: 4px; }
  @media (max-width: 760px) { .picker { grid-template-columns: 1fr; padding: 32px 20px; } }
</style>
