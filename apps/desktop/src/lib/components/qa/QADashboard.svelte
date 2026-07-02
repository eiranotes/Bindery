<script lang="ts">
  import { qaStore } from '$lib/stores/qaStore';
  import { revisionStore } from '$lib/stores/revisionStore';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import { runQAAction } from '$lib/actions/pipeline';
  import { toasts } from '$lib/stores/toastStore';
  import type { QAIssue } from '$lib/domain/reports';

  const severityLabel: Record<QAIssue['severity'], string> = { fail: '필수', warn: '주의', info: '참고' };
  const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;

  function issueKey(i: QAIssue, idx: number) { return `${i.source ?? ''}-${i.lineStart ?? ''}-${idx}`; }

  function jump(i: QAIssue) {
    if (i.lineStart) gotoLine(i.lineStart);
  }
  function addToRevision(i: QAIssue) {
    revisionStore.update((s) => ({
      ...s,
      items: [...s.items, { id: `rev-${Date.now()}`, text: i.title ? `${i.title}: ${i.message}` : i.message, severity: i.severity, status: 'todo', file: i.file, lineStart: i.lineStart }]
    }));
    toasts.push('수정 계획에 추가됨', 'ok');
  }
  function markFalsePositive(key: string) {
    qaStore.update((s) => { const fp = new Set(s.falsePositives); fp.add(key); return { ...s, falsePositives: fp }; });
  }
</script>

<div class="card">
  <div class="kpi">
    <strong>QA 대시보드</strong>
    <div class="qa-head-right">
      {#if $qaStore.report}
        <span class="verdict {$qaStore.report.verdict}">{verdictLabel[$qaStore.report.verdict]} {$qaStore.report.score ?? '-'}</span>
      {/if}
      <button class="ghost tiny" on:click={runQAAction} disabled={$qaStore.running}>{$qaStore.running ? '...' : 'QA 실행'}</button>
    </div>
  </div>

  {#if !$qaStore.report}
    <p class="muted">QA를 실행하면 게이트 점수와 수정 대상 이슈가 표시됩니다.</p>
  {:else}
    <div class="gate-grid">
      {#each $qaStore.report.gates as g}
        <div class="gate {g.verdict}">
          <span class="gate-name">{g.name}</span>
          <span class="gate-score">{g.score}</span>
          <div class="gate-bar"><i style={`width:${g.score}%`}></i></div>
        </div>
      {/each}
    </div>

    {#if $qaStore.report.issues.length}
      {@const visibleIssues = $qaStore.report.issues.filter((it, i) => !$qaStore.falsePositives.has(issueKey(it, i)))}
      <div class="issues">
        <div class="issues-head">이슈 {visibleIssues.length}건</div>
        {#each $qaStore.report.issues as issue, idx}
          {#if !$qaStore.falsePositives.has(issueKey(issue, idx))}
            <div class="issue">
              <div class="issue-top">
                <span class="sev {issue.severity}">{severityLabel[issue.severity]}</span>
                <span class="issue-title">{issue.title || issue.message}</span>
                {#if issue.lineStart}<button class="loc" on:click={() => jump(issue)}>L{issue.lineStart}</button>{/if}
              </div>
              {#if issue.title}<div class="issue-msg">{issue.message}</div>{/if}
              {#if issue.suggestedAction}<div class="issue-act">권장: {issue.suggestedAction}</div>{/if}
              <div class="issue-buttons">
                <button class="mini" on:click={() => addToRevision(issue)}>수정 계획에 추가</button>
                <button class="mini ghost" on:click={() => markFalsePositive(issueKey(issue, idx))}>오탐 처리</button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .qa-head-right { display: flex; align-items: center; gap: 8px; }
  .verdict { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
  .verdict.pass { color: var(--ok); border: 1px solid rgba(52,211,153,.4); }
  .verdict.warn { color: var(--warn); border: 1px solid rgba(251,191,36,.4); }
  .verdict.fail { color: var(--bad); border: 1px solid rgba(251,113,133,.4); }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .muted { color: var(--muted); font-size: 13px; }
  .gate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .gate { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; }
  .gate-name { font-size: 12px; color: var(--muted); }
  .gate-score { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .gate-bar { grid-column: 1 / -1; height: 3px; background: var(--line); border-radius: 3px; overflow: hidden; }
  .gate-bar i { display: block; height: 100%; background: var(--muted); }
  .gate.pass .gate-score, .gate.pass .gate-bar i { color: var(--ok); background: var(--ok); }
  .gate.warn .gate-score { color: var(--warn); } .gate.warn .gate-bar i { background: var(--warn); }
  .gate.fail .gate-score { color: var(--bad); } .gate.fail .gate-bar i { background: var(--bad); }
  .gate.pass .gate-score { background: none; }
  .issues { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .issues-head { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--faint); }
  .issue { border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; background: var(--hover); }
  .issue-top { display: flex; align-items: center; gap: 8px; }
  .sev { font-size: 9.5px; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 5px; }
  .sev.fail { color: var(--bad); background: var(--bad-soft); }
  .sev.warn { color: var(--warn); background: var(--warn-soft); }
  .sev.info { color: var(--accent-2); background: var(--accent-2-soft); }
  .issue-title { font-size: 13px; flex: 1; }
  .loc { padding: 2px 7px; font-size: 10.5px; font-family: ui-monospace, monospace; background: var(--accent-soft); border: 0; border-radius: 6px; color: var(--accent); }
  .issue-msg { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
  .issue-act { font-size: 11.5px; color: var(--accent-2); margin-top: 4px; }
  .issue-buttons { display: flex; gap: 6px; margin-top: 8px; }
  .mini { padding: 4px 8px; font-size: 11px; border-radius: 7px; }
  .mini.ghost { background: var(--chip); }
</style>
