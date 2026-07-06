<script lang="ts">
  // 세계관 화면 - 채택 소재, 확장 proposal 생성, 승인된 제안·정사 화면, 자산 목록, 바이블 조립.
  import { onMount } from 'svelte';
  import { ctx, ideas, tree, project, withBusy, toast, mode, proposals } from '$lib/stores/app';
  import { expandWorld, renderWorldProposalArtifact } from '$lib/harness/world';
  import { assembleBible, applyBibleCandidate } from '$lib/harness/bible';
  import { readOptional } from '$lib/harness/project';
  import { exportPacket, recordImport } from '$lib/harness/exchange';
  import { previewPrompt } from '$lib/harness/runner';
  import { writeArtifact } from '$lib/harness/artifacts';
  import { BLUEPRINTS } from '$lib/prompts';
  import { parseWorldExpansionProposal } from '$lib/schemas/contracts';
  import { registerWorldExpansion, saveProposal } from '$lib/harness/proposals';
  import { clip } from '$lib/core/text';
  import { LAYOUT } from '$lib/core/layout';
  import type { FileNode } from '$lib/bridge';

  let notes = $state('');
  let showExchange = $state(false);
  let exchangeId = $state('');
  let exchangePacket = $state('');
  let importText = $state('');
  let bible = $state('');
  let bibleCandidate = $state('');
  let bibleCandidatePath = $state('');
  let viewing = $state<{ path: string; content: string } | null>(null);

  const selected = $derived($ideas.filter((i) => i.status === 'selected'));

  function assetFiles(nodes: FileNode[]): FileNode[] {
    const out: FileNode[] = [];
    const walk = (list: FileNode[]) => {
      for (const n of list) {
        if (n.kind === 'file' && /^(characters|world|relationships)\//.test(n.path) && n.name.endsWith('.md') && n.name !== 'README.md' && !n.name.startsWith('.')) out.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }
  const assets = $derived(assetFiles($tree));

  onMount(refreshBible);

  async function refreshBible() {
    bible = await readOptional(ctx(), LAYOUT.canon.bible);
  }

  async function expand() {
    if (selected.length === 0) {
      toast('채택된 소재가 없습니다. 소재 화면에서 먼저 채택하세요', 'warn');
      return;
    }
    const result = await withBusy('세계관 확장 proposal', () => expandWorld(ctx(), selected, notes));
    if (result) {
      toast(
        result.outcome.source === 'agent'
          ? `자산 ${result.proposal.payload.assets.length}건 제안됨 - 제안·정사 화면에서 승인하세요`
          : '로컬 뼈대 proposal 생성됨 - 내용을 채우기 전에는 승인하지 마세요',
        result.outcome.source === 'agent' ? 'ok' : 'warn'
      );
      mode.set('canon');
    }
  }

  async function assemble() {
    const result = await withBusy('바이블 조립', () => assembleBible(ctx(), $project?.title ?? '작품', selected), false);
    if (result) {
      bibleCandidatePath = result.candidatePath;
      bibleCandidate = await ctx().bridge.readFile(ctx().root, result.candidatePath);
      toast(result.outcome.source === 'agent' ? '바이블 후보 생성됨 - 검토 후 적용하세요' : '오프라인 조립본 생성됨', result.outcome.source === 'agent' ? 'ok' : 'warn');
    }
  }

  async function applyBible() {
    await withBusy('바이블 적용', async () => {
      await applyBibleCandidate(ctx(), bibleCandidatePath);
      toast('canon/setting-bible.md 교체됨 (이전본은 스냅샷으로 보존)', 'ok');
      bibleCandidate = '';
      bibleCandidatePath = '';
      await refreshBible();
    });
  }

  async function view(path: string) {
    viewing = { path, content: await ctx().bridge.readFile(ctx().root, path) };
  }

  async function expansionVars() {
    const c = ctx();
    return {
      selectedSeeds: selected.map((i) => `### ${i.seed.title}\n- 훅: ${i.seed.hook}\n- 감정 엔진: ${i.seed.emotional_engine}\n- 독자 약속: ${i.seed.reader_promise}`).join('\n\n') || '(채택 소재 없음)',
      canonContext: clip(await readOptional(c, LAYOUT.canon.bible), 4000) || '(기존 확정 설정 없음)',
      notes: notes || '(없음)',
      assetCount: '8'
    };
  }

  async function makePacket() {
    const prompt = previewPrompt({ blueprint: BLUEPRINTS.worldExpansion, vars: await expansionVars() });
    const packet = await withBusy('packet 내보내기', () => exportPacket(ctx(), 'world-expansion', prompt), false);
    if (packet) {
      exchangeId = packet.exchangeId;
      exchangePacket = packet.packet;
      showExchange = true;
      toast(`packet 저장됨: ${packet.packetPath}`, 'ok');
    }
  }

  async function copyPacket() {
    await navigator.clipboard.writeText(exchangePacket);
    toast('packet이 클립보드에 복사됨 - 웹 AI에 붙여넣으세요', 'ok');
  }

  async function importResult() {
    const parsed = parseWorldExpansionProposal(importText);
    if (!parsed) {
      if (exchangeId) await recordImport(ctx(), exchangeId, importText, false, 'schema validation failed');
      toast('가져오기 실패: bindery.world_expansion_proposal.v1 JSON이 아닙니다', 'bad');
      return;
    }
    await withBusy('웹 AI 결과 가져오기', async () => {
      const c = ctx();
      const proposal = registerWorldExpansion(parsed, 'web-import');
      await saveProposal(c, proposal);
      await writeArtifact(c, 'work', 'world-expansion', `세계관 확장 proposal (웹 교환) · 자산 ${parsed.assets.length}건`, renderWorldProposalArtifact(parsed), 'web-import');
      if (exchangeId) await recordImport(c, exchangeId, importText, true);
      toast(`웹 AI 제안 등록됨 (자산 ${parsed.assets.length}건) - 제안·정사 화면에서 승인하세요`, 'ok');
      importText = '';
      showExchange = false;
    });
    mode.set('canon');
  }
</script>

<div class="surface">
  <header class="head">
    <h1>세계관 · 바이블</h1>
    <p class="dim">확장은 proposal로만 만들어지고, 승인된 자산만 characters/ · world/ 파일이 됩니다.</p>
  </header>

  <section>
      <span class="label">세계관 확장 - 채택 소재 {selected.length}건 기반</span>
    {#if selected.length}
      <ul class="seedline">{#each selected as s}<li>{s.seed.title}</li>{/each}</ul>
    {:else}
      <p class="empty">채택된 소재가 없습니다. <button class="quiet" onclick={() => mode.set('ideas')}>소재 화면으로</button></p>
    {/if}
    <div class="row">
      <input bind:value={notes} placeholder="확장 방향 지시 (선택)" />
      <button class="primary" onclick={expand} disabled={selected.length === 0}>확장 proposal 생성</button>
      <button onclick={makePacket} disabled={selected.length === 0}>웹 AI packet</button>
      <button class="quiet" onclick={() => (showExchange = !showExchange)}>{showExchange ? '교환 닫기' : '웹 AI 결과 가져오기'}</button>
    </div>
    {#if showExchange}
      <div class="exchange">
        {#if exchangePacket}
          <div class="row"><button onclick={copyPacket}>packet 복사</button><span class="dim">.bindery/exchange/{exchangeId}/packet.md 에도 저장됨</span></div>
        {/if}
        <textarea rows="6" bind:value={importText} placeholder="웹 AI가 돌려준 world_expansion_proposal JSON을 붙여넣으세요"></textarea>
        <div class="row"><button class="primary" onclick={importResult} disabled={!importText.trim()}>검증 후 proposal로 등록</button></div>
      </div>
    {/if}
  </section>

  <section>
    <span class="label">승인된 자산 파일 ({assets.length})</span>
    {#if assets.length === 0}
      <p class="empty">아직 자산이 없습니다. 확장 proposal을 승인하면 여기 파일이 생깁니다.</p>
    {:else}
      <div class="split">
        <ul class="files">
          {#each assets as f (f.path)}
            <li><button class="quiet" class:on={viewing?.path === f.path} onclick={() => view(f.path)}><span class="mono">{f.path}</span></button></li>
          {/each}
        </ul>
        {#if viewing}
          <div class="viewer">
            <div class="row"><span class="mono dim">{viewing.path}</span><button class="quiet" onclick={() => mode.set('files')}>파일 화면에서 수정</button></div>
            <pre class="pre">{viewing.content}</pre>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <section>
    <span class="label">설정 바이블 - canon/setting-bible.md</span>
    <div class="row">
      <button class="primary" onclick={assemble} disabled={assets.length === 0 && selected.length === 0}>자산에서 바이블 조립</button>
      <span class="dim">조립 결과는 후보로 만들어지며, 적용 시 기존 바이블은 스냅샷으로 보존됩니다.</span>
    </div>
    {#if bibleCandidate}
      <div class="candidate">
        <div class="row"><b>바이블 후보</b><span class="mono dim">{bibleCandidatePath}</span>
          <button class="primary" onclick={applyBible}>이 후보로 교체</button>
          <button onclick={() => { bibleCandidate = ''; bibleCandidatePath = ''; }}>버리기</button>
        </div>
        <pre class="pre">{bibleCandidate}</pre>
      </div>
    {/if}
    <details>
      <summary>현재 바이블 보기</summary>
      <pre class="pre">{bible || '(없음)'}</pre>
    </details>
  </section>
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 20px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 0; }
  section { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .row input { flex: 1; min-width: 200px; }
  .seedline { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; }
  .exchange { display: grid; gap: 6px; border: 1px dashed var(--line-strong); border-radius: 4px; padding: 10px; }
  .seedline li { font-size: 12px; color: var(--accent); background: var(--accent-soft); border-radius: 3px; padding: 2px 8px; }
  .split { display: grid; grid-template-columns: minmax(220px, 320px) minmax(0, 1fr); gap: 18px; align-items: start; }
  .files { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow: auto; }
  .files button { width: 100%; text-align: left; padding: 5px 4px; border-bottom: 1px solid var(--line); border-radius: 0; font-size: 11.5px; }
  .files button.on { background: var(--accent-soft); }
  .viewer { display: grid; gap: 6px; }
  .viewer .pre { max-height: 320px; overflow: auto; border-top: 1px solid var(--line); padding-top: 8px; }
  .candidate { display: grid; gap: 6px; border: 1px solid var(--accent); border-radius: 4px; padding: 10px; background: var(--bg-1); }
  .candidate .pre { max-height: 300px; overflow: auto; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12.5px; }
  details .pre { max-height: 320px; overflow: auto; margin-top: 8px; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
</style>
