<script lang="ts">
  // 홈 — 재개 상태(resume state)와 다음 작업. 장기 연재의 "어디까지 했더라"를 없앤다.
  import { onMount } from 'svelte';
  import { ctx, mode, ideas, plot, episodes, progress, pendingProposals, currentEpisode } from '$lib/stores/app';
  import { readOptional } from '$lib/harness/project';
  import { LAYOUT } from '$lib/core/layout';

  let resume = $state('');

  onMount(async () => {
    resume = await readOptional(ctx(), LAYOUT.status.resume);
  });

  const selectedCount = $derived($ideas.filter((i) => i.status === 'selected').length);
  const approvedPlot = $derived($plot?.episodes.filter((e) => e.status === 'approved').length ?? 0);
  const fixedCount = $derived($episodes.filter((e) => $progress[e]?.status === 'fixed').length);

  type NextAction = { label: string; desc: string; go: () => void };
  const nextActions = $derived.by((): NextAction[] => {
    const out: NextAction[] = [];
    if ($pendingProposals > 0) out.push({ label: '대기 중 제안 검토', desc: `${$pendingProposals}건의 proposal이 승인을 기다립니다`, go: () => mode.set('canon') });
    if (selectedCount === 0 && fixedCount === 0) out.push({ label: '소재 발굴', desc: '조건을 넣고 소재 후보를 만들거나 직접 작성하세요', go: () => mode.set('ideas') });
    if (selectedCount > 0 && approvedPlot === 0) out.push({ label: '세계관 확장 → 플롯', desc: '채택 소재로 자산을 제안받고 플롯을 승인하세요', go: () => mode.set('world') });
    if (approvedPlot > 0) {
      const next = $episodes.find((e) => $progress[e]?.status !== 'fixed') ?? $episodes[$episodes.length - 1];
      out.push({ label: `${next} 집필 이어가기`, desc: '브리프 → 장면 → 초안 후보 → QA → 픽스', go: () => { currentEpisode.set(next); mode.set('episode'); } });
    }
    return out;
  });
</script>

<div class="surface">
  <header class="head">
    <h1>홈</h1>
    <p class="dim">픽스 {fixedCount}화 · 플롯 승인 {approvedPlot}화 · 채택 소재 {selectedCount}건</p>
  </header>

  <section>
    <span class="label">다음 작업</span>
    {#if nextActions.length === 0}
      <p class="empty">모든 흐름이 진행 중입니다. 좌측에서 원하는 단계를 선택하세요.</p>
    {:else}
      <div class="actions">
        {#each nextActions as a}
          <button class="action" onclick={a.go}>
            <b>{a.label}</b>
            <span>{a.desc}</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <span class="label">재개 상태 — status/resume-state.md (기록·픽스 단계가 자동 갱신)</span>
    <pre class="pre resume">{resume || '(아직 없음)'}</pre>
  </section>
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 22px; align-content: start; max-width: 900px; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 0; }
  section { display: grid; gap: 8px; }
  .actions { display: grid; gap: 0; border-top: 1px solid var(--line); }
  .action {
    display: grid; gap: 2px; text-align: left; padding: 12px 8px;
    border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent;
  }
  .action:hover { background: var(--accent-soft); }
  .action b { color: var(--accent); font-size: 14px; }
  .action span { color: var(--muted); font-size: 12px; }
  .resume { border-top: 1px solid var(--line); padding-top: 10px; color: var(--muted); }
</style>
