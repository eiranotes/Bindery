<script lang="ts">
  // 좌측 구조 탐색 — 단계 자산의 현재 상태를 세면서 해당 화면으로 이동한다.
  import { mode, ideas, proposals, plot, episodes, progress, currentEpisode, tree } from '$lib/stores/app';
  import type { Mode } from '$lib/stores/app';
  import type { FileNode } from '$lib/bridge';

  function count(status: string): number {
    return $ideas.filter((i) => i.status === status).length;
  }
  function go(m: Mode) {
    mode.set(m);
  }
  function goEpisode(ep: string) {
    currentEpisode.set(ep);
    mode.set('episode');
  }
  function countAssets(nodes: FileNode[], prefix: string): number {
    let n = 0;
    const walk = (list: FileNode[]) => {
      for (const node of list) {
        if (node.kind === 'file' && node.path.startsWith(prefix) && node.name.endsWith('.md') && node.name !== 'README.md' && !node.name.startsWith('.')) n++;
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return n;
  }
  const pendingByType = $derived({
    world: $proposals.filter((p) => p.type === 'world-expansion' && (p.status === 'pending' || p.status === 'partial')).length,
    canon: $proposals.filter((p) => p.type === 'canon-delta' && (p.status === 'pending' || p.status === 'partial')).length
  });
  const approvedPlot = $derived($plot?.episodes.filter((e) => e.status === 'approved').length ?? 0);
  const statusLabel: Record<string, string> = { planned: '기획', drafting: '집필', fixed: '픽스' };
</script>

<aside class="side">
  <section>
    <button class="head quiet" onclick={() => go('ideas')}><span class="label">소재</span></button>
    <div class="rows">
      <button class="row quiet" onclick={() => go('ideas')}><span>후보(inbox)</span><b>{count('inbox')}</b></button>
      <button class="row quiet" onclick={() => go('ideas')}><span>씨앗</span><b>{count('seeds')}</b></button>
      <button class="row quiet" onclick={() => go('ideas')}><span>채택</span><b class:hot={count('selected') > 0}>{count('selected')}</b></button>
      <button class="row quiet" onclick={() => go('ideas')}><span>폐기</span><b>{count('discarded')}</b></button>
    </div>
  </section>

  <section>
    <button class="head quiet" onclick={() => go('world')}><span class="label">세계관 · 바이블</span></button>
    <div class="rows">
      <button class="row quiet" onclick={() => go('world')}><span>인물</span><b>{countAssets($tree, 'characters/')}</b></button>
      <button class="row quiet" onclick={() => go('world')}><span>세계 자산</span><b>{countAssets($tree, 'world/')}</b></button>
      <button class="row quiet" onclick={() => go('canon')}><span>확장 제안 대기</span><b class:hot={pendingByType.world > 0}>{pendingByType.world}</b></button>
    </div>
  </section>

  <section>
    <button class="head quiet" onclick={() => go('plot')}><span class="label">플롯</span></button>
    <div class="rows">
      <button class="row quiet" onclick={() => go('plot')}>
        <span>회별 계획</span><b>{$plot ? `${approvedPlot}/${$plot.episodes.length} 승인` : '없음'}</b>
      </button>
    </div>
  </section>

  <section>
    <button class="head quiet" onclick={() => go('episode')}><span class="label">회차</span></button>
    <div class="rows episodes">
      {#each $episodes as ep}
        <button class="row quiet" class:on={$currentEpisode === ep} onclick={() => goEpisode(ep)}>
          <span class="mono">{ep}</span>
          <b class="st {$progress[ep]?.status ?? 'planned'}">{statusLabel[$progress[ep]?.status ?? 'planned']}</b>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <button class="head quiet" onclick={() => go('canon')}><span class="label">제안 · 정사</span></button>
    <div class="rows">
      <button class="row quiet" onclick={() => go('canon')}><span>정사 변경 대기</span><b class:hot={pendingByType.canon > 0}>{pendingByType.canon}</b></button>
    </div>
  </section>
</aside>

<style>
  .side {
    grid-area: side;
    min-height: 0; overflow: auto;
    background: var(--bg-rail);
    border-right: 1px solid var(--line);
    padding: 12px 10px;
    display: grid; gap: 14px; align-content: start;
  }
  section { display: grid; gap: 3px; }
  .head { text-align: left; padding: 2px 4px; border: 0; }
  .rows { display: grid; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 6px; border: 0; border-radius: 4px; font-size: 12px;
  }
  .row span { color: var(--muted); }
  .row b { color: var(--faint); font-weight: 650; font-size: 11.5px; }
  .row:hover { background: var(--accent-soft); }
  .row.on { background: var(--accent-soft); }
  .row.on span { color: var(--text); font-weight: 650; }
  b.hot { color: var(--warn); }
  .episodes { max-height: 220px; overflow: auto; }
  .st.fixed { color: var(--ok); }
  .st.drafting { color: var(--accent); }
</style>
