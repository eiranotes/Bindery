<script lang="ts">
  // 플롯 화면 - 회별 계획 제안, 표에서 직접 수정, 회차별 승인.
  // 승인된 회차만 회차 브리프의 hard constraint가 된다.
  import { ctx, plot, withBusy, toast, mode, currentEpisode } from '$lib/stores/app';
  import { proposePlot, approvePlotEpisodes, updatePlotRow, savePlotPlan, renderPlotOutline } from '$lib/harness/plot';
  import { exportPacket, recordImport } from '$lib/harness/exchange';
  import { previewPrompt } from '$lib/harness/runner';
  import { writeArtifact } from '$lib/harness/artifacts';
  import { readOptional } from '$lib/harness/project';
  import { BLUEPRINTS } from '$lib/prompts';
  import { LAYOUT } from '$lib/core/layout';
  import { clip, nowIso } from '$lib/core/text';
  import { parsePlotPlan } from '$lib/schemas/contracts';
  import type { PlotEpisodeRow } from '$lib/schemas/contracts';

  let episodeCount = $state(8);
  let notes = $state('');
  let editing = $state<string | null>(null);
  let draft = $state<{ title: string; goal: string; beats: string; hook: string }>({ title: '', goal: '', beats: '', hook: '' });
  let showExchange = $state(false);
  let exchangePacket = $state('');
  let exchangeId = $state('');
  let importText = $state('');

  async function propose() {
    const result = await withBusy('플롯 계획 제안', () => proposePlot(ctx(), episodeCount, notes));
    if (result) {
      toast(
        result.source === 'agent'
          ? `${result.output.episodes.length}화 계획 제안됨 - 회차별로 검토·승인하세요 (승인된 회차는 보존됨)`
          : '로컬 뼈대 계획 생성됨 - 내용을 채우거나 AI 연결 후 재실행하세요',
        result.source === 'agent' ? 'ok' : 'warn'
      );
    }
  }

  async function makePacket() {
    const c = ctx();
    const prompt = previewPrompt({
      blueprint: BLUEPRINTS.plotPlan,
      vars: {
        episodeCount: String(episodeCount),
        bible: clip(await readOptional(c, LAYOUT.canon.bible), 8000) || '(바이블 없음)',
        openThreads: clip(await readOptional(c, LAYOUT.plot.openThreads), 2000) || '(없음)',
        existingPlot: $plot ? clip(JSON.stringify($plot.episodes.filter((e) => e.status === 'approved'), null, 1), 6000) : '(없음)',
        notes: notes || '(없음)'
      }
    });
    const packet = await withBusy('plot packet 내보내기', () => exportPacket(c, 'plot-plan', prompt), false);
    if (packet) {
      exchangeId = packet.exchangeId;
      exchangePacket = packet.packet;
      showExchange = true;
      toast(`packet 저장됨: ${packet.packetPath}`, 'ok');
    }
  }

  async function copyPacket() {
    await navigator.clipboard.writeText(exchangePacket);
    toast('packet이 클립보드에 복사됨', 'ok');
  }

  async function importResult() {
    const parsed = parsePlotPlan(importText, nowIso());
    if (!parsed) {
      if (exchangeId) await recordImport(ctx(), exchangeId, importText, false, 'schema validation failed');
      toast('가져오기 실패: bindery.plot_plan.v1 JSON이 아닙니다', 'bad');
      return;
    }
    await withBusy('웹 플롯 가져오기', async () => {
      const c = ctx();
      const previous = $plot;
      const next = { ...parsed, source: 'web-import' as const, updatedAt: nowIso() };
      if (previous) {
        for (let i = 0; i < next.episodes.length; i++) {
          const before = previous.episodes.find((e) => e.episode === next.episodes[i].episode);
          if (before?.status === 'approved') next.episodes[i] = before;
        }
      }
      await savePlotPlan(c, next);
      await writeArtifact(c, 'work', 'plot-plan', `플롯 계획 ${next.episodes.length}화 (웹 교환)`, renderPlotOutline(next), 'web-import');
      if (exchangeId) await recordImport(c, exchangeId, importText, true);
      importText = '';
      showExchange = false;
      toast(`웹 플롯 ${next.episodes.length}화 가져옴`, 'ok');
    });
  }

  async function approve(episodes: string[]) {
    await withBusy('플롯 승인', async () => {
      await approvePlotEpisodes(ctx(), episodes);
      toast(`${episodes.join(', ')} 승인됨`, 'ok');
    });
  }

  function startEdit(row: PlotEpisodeRow) {
    editing = row.episode;
    draft = { title: row.title, goal: row.goal, beats: row.beats.join(' / '), hook: row.hook };
  }

  async function saveEdit(episode: string) {
    await withBusy('플롯 수정', async () => {
      await updatePlotRow(ctx(), episode, {
        title: draft.title,
        goal: draft.goal,
        beats: draft.beats.split('/').map((b) => b.trim()).filter(Boolean),
        hook: draft.hook
      });
    });
    editing = null;
  }

  function writeEpisode(ep: string) {
    currentEpisode.set(ep);
    mode.set('episode');
  }
</script>

<div class="surface">
  <header class="head">
    <h1>플롯</h1>
    <p class="dim">plot/plot-board.json이 진실이며 plot/series-outline.md로 함께 렌더됩니다. 표에서 직접 수정할 수 있습니다.</p>
  </header>

  <section class="row">
    <label>총 회차 <input type="number" min="2" max="60" bind:value={episodeCount} /></label>
    <input class="notes" bind:value={notes} placeholder="플롯 방향 지시 (선택)" />
    <button class="primary" onclick={propose}>회별 계획 제안</button>
    <button onclick={makePacket}>웹 AI packet</button>
    <button class="quiet" onclick={() => (showExchange = !showExchange)}>{showExchange ? '교환 닫기' : '웹 AI 결과 가져오기'}</button>
    {#if $plot}
      <button onclick={() => approve($plot!.episodes.filter((e) => e.status === 'draft').map((e) => e.episode))}>미승인 전체 승인</button>
    {/if}
  </section>

  {#if showExchange}
    <section class="exchange">
      <span class="label">웹 AI 교환 - plot-plan</span>
      {#if exchangePacket}
        <div class="row"><button onclick={copyPacket}>packet 복사</button><span class="dim">.bindery/exchange/{exchangeId}/packet.md</span></div>
      {/if}
      <textarea rows="6" bind:value={importText} placeholder="웹 AI가 돌려준 plot_plan JSON을 붙여넣으세요"></textarea>
      <div class="row"><button class="primary" onclick={importResult} disabled={!importText.trim()}>검증 후 플롯으로 등록</button></div>
    </section>
  {/if}

  {#if !$plot}
    <p class="empty">아직 플롯 계획이 없습니다. 바이블이 있으면 제안 정확도가 올라갑니다.</p>
  {:else}
    {#each $plot.arcs as arc}
      <section>
        <span class="label">{arc.label} {arc.episodes ? `(${arc.episodes})` : ''} - {arc.goal || '목표 미정'}</span>
        <table class="grid">
          <thead><tr><th>회차</th><th>제목 · 목적</th><th>beats</th><th>떡밥</th><th>hook</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {#each $plot.episodes.filter((e) => e.arc === arc.id) as row (row.episode)}
              <tr>
                <td class="mono">{row.episode}</td>
                {#if editing === row.episode}
                  <td colspan="4" class="editcell">
                    <input bind:value={draft.title} placeholder="제목" />
                    <input bind:value={draft.goal} placeholder="목적" />
                    <input bind:value={draft.beats} placeholder="beats ( / 로 구분)" />
                    <input bind:value={draft.hook} placeholder="hook" />
                  </td>
                  <td><button class="primary" onclick={() => saveEdit(row.episode)}>저장</button></td>
                  <td><button class="quiet" onclick={() => (editing = null)}>취소</button></td>
                {:else}
                  <td>
                    <b>{row.title}</b>
                    <p class="goal">{row.goal}</p>
                    {#if row.risk}<p class="risk">위험: {row.risk}</p>{/if}
                  </td>
                  <td class="beats">{row.beats.join(', ') || '-'}</td>
                  <td class="dim">심기 {row.threads_open.join(', ') || '-'}<br />회수 {row.threads_close.join(', ') || '-'}</td>
                  <td class="dim">{row.hook || '-'}</td>
                  <td>
                    {#if row.status === 'approved'}<span class="chip ok">승인</span>{:else}<span class="chip warn">검토</span>{/if}
                  </td>
                  <td class="acts">
                    <button class="quiet" onclick={() => startEdit(row)}>수정</button>
                    {#if row.status !== 'approved'}<button class="quiet" onclick={() => approve([row.episode])}>승인</button>{/if}
                    {#if row.status === 'approved'}<button class="quiet" onclick={() => writeEpisode(row.episode)}>집필 시작</button>{/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}
  {/if}
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 18px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 0; }
  .row { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 12px; }
  .row label { display: grid; gap: 3px; font-size: 11.5px; color: var(--muted); }
  .row input[type='number'] { width: 70px; }
  .notes { flex: 1; min-width: 200px; }
  section { display: grid; gap: 6px; }
  .exchange { border-top: 1px solid var(--line); padding-top: 12px; }
  .exchange textarea { min-height: 120px; }
  td b { font-size: 13px; }
  .goal { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
  .risk { margin: 2px 0 0; color: var(--warn); font-size: 11.5px; }
  .beats { font-size: 12px; color: var(--muted); max-width: 220px; }
  .acts { white-space: nowrap; }
  .editcell { display: grid; gap: 4px; }
</style>
