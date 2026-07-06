<script lang="ts">
  // 우측 인스펙터 - 최근 실행의 투명성(모델/시간/프롬프트 파일)과 대기 중 결정.
  import { runlog, proposals, selectedRun, runDockOpen, mode, settings, project } from '$lib/stores/app';

  const last = $derived($selectedRun ?? $runlog[0] ?? null);
  const pending = $derived($proposals.filter((p) => p.status === 'pending' || p.status === 'partial'));

  function fmtMs(ms: number): string {
    return ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
  }
</script>

<aside class="inspector">
  <section>
    <span class="label">최근 실행</span>
    {#if !last}
      <p class="empty">아직 실행 기록이 없습니다.</p>
    {:else}
      <dl class="kv">
        <div><dt>단계</dt><dd class="mono">{last.stage} · {last.scope}</dd></div>
        <div><dt>경로</dt><dd>
          {#if last.source === 'agent'}<span class="chip ok">AI</span>
          {:else if last.source === 'web-import'}<span class="chip info">웹 교환</span>
          {:else}<span class="chip warn">로컬 폴백</span>{/if}
          {#if last.repairUsed}<span class="chip muted">repair</span>{/if}
        </dd></div>
        <div><dt>시간</dt><dd>{fmtMs(last.durationMs)}</dd></div>
        <div><dt>실행기</dt><dd class="mono">{last.command || '-'}{last.model ? ` (${last.model})` : ''}</dd></div>
        {#if last.parseFailReason}<div><dt>폴백 사유</dt><dd class="warn-text">{last.parseFailReason}</dd></div>{/if}
        {#if last.promptFile}<div><dt>프롬프트</dt><dd class="mono small">{last.promptFile}</dd></div>{/if}
        {#if last.stderrTail}<div><dt>stderr</dt><dd class="mono small">{last.stderrTail.slice(-260)}</dd></div>{/if}
      </dl>
      <button class="quiet" onclick={() => runDockOpen.set(true)}>전체 기록 열기</button>
    {/if}
  </section>

  <section>
    <span class="label">대기 중 결정</span>
    {#if pending.length === 0}
      <p class="empty">승인 대기 제안이 없습니다.</p>
    {:else}
      <ul class="pending">
        {#each pending as p}
          <li>
            <button class="quiet" onclick={() => mode.set('canon')}>
              <span class="chip {p.type === 'canon-delta' ? 'warn' : 'info'}">{p.type === 'canon-delta' ? '정사' : '세계관'}</span>
              <span>{p.type === 'world-expansion' ? `자산 ${p.payload.assets.length}건` : `${p.episode} 변경 ${p.payload.changes.length}건`}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section>
    <span class="label">원칙</span>
    <p class="rule">AI 출력은 후보·제안으로만 남습니다. canon 파일과 원고 반영은 항상 사람의 승인과 스냅샷을 거칩니다.</p>
    {#if $settings.offline}
      <p class="rule warn-text">오프라인 모드: 모든 단계는 로컬 뼈대로 동작합니다.</p>
    {/if}
    <p class="rule mono small">{$project?.root}</p>
  </section>
</aside>

<style>
  .inspector {
    grid-area: insp;
    min-height: 0; overflow: auto;
    background: var(--bg-1);
    border-left: 1px solid var(--line);
    padding: 12px;
    display: grid; gap: 16px; align-content: start;
  }
  section { display: grid; gap: 6px; }
  .kv { display: grid; margin: 0; border-top: 1px solid var(--line); }
  .kv > div { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--line); }
  .kv dt { color: var(--faint); font-size: 11px; }
  .kv dd { margin: 0; font-size: 12px; overflow-wrap: anywhere; }
  .small { font-size: 10.5px; color: var(--faint); }
  .warn-text { color: var(--warn); }
  .pending { list-style: none; margin: 0; padding: 0; display: grid; }
  .pending button { display: flex; gap: 6px; align-items: center; width: 100%; text-align: left; padding: 5px 2px; border-bottom: 1px solid var(--line); border-radius: 0; font-size: 12px; }
  .rule { margin: 0; font-size: 11.5px; color: var(--muted); line-height: 1.6; }
</style>
