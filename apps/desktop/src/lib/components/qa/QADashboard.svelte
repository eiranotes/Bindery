<script lang="ts">
  import { qaStore } from '$lib/stores/qaStore';
  import { revisionStore } from '$lib/stores/revisionStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import { runQAAction } from '$lib/actions/pipeline';
  import { toasts } from '$lib/stores/toastStore';
  import type { QAIssue } from '$lib/domain/reports';

  const severityLabel: Record<QAIssue['severity'], string> = { fail: '필수', warn: '주의', info: '참고' };
  const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;

  $: activeCandidate = $candidateStore.candidates.find((c) => c.id === $candidateStore.activeId) ?? null;

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

<div class="qa-panel">
  <div class="qa-head">
    <strong>QA 대시보드</strong>
    {#if $qaStore.report}
      <span class="verdict {$qaStore.report.verdict}">{verdictLabel[$qaStore.report.verdict]} {$qaStore.report.score ?? '-'}</span>
    {/if}
  </div>

  <div class="qa-actions">
    <span class="label">검사 대상</span>
    <button class="ghost tiny" on:click={() => runQAAction('current-editor')} disabled={$qaStore.running}>{$qaStore.running ? '...' : '현재 원고'}</button>
    <button class="ghost tiny" on:click={() => runQAAction('candidate')} disabled={$qaStore.running || !activeCandidate} title={activeCandidate ? `${activeCandidate.label} QA` : '후보를 선택하세요'}>
      {activeCandidate ? `${activeCandidate.label}` : '후보 없음'}
    </button>
  </div>

  {#if $qaStore.target}
    <div class="qa-target">
      <span>검사 대상: <b>{$qaStore.target.label}</b></span>
      <code class="mono">{$qaStore.target.contentHash.slice(0, 8)}</code>
      <span class="ep">· {$qaStore.target.episode}</span>
    </div>
  {/if}

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
  .qa-panel { display: grid; gap: 8px; padding: 8px 4px 12px; }
  .qa-head { display: flex; align-items: center; gap: 10px; }
  .verdict { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
  .verdict.pass { color: var(--ok); border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent); }
  .verdict.warn { color: var(--warn); border: 1px solid color-mix(in srgb, var(--warn) 40%, transparent); }
  .verdict.fail { color: var(--bad); border: 1px solid color-mix(in srgb, var(--bad) 40%, transparent); }
  .qa-actions { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .label { color: var(--faint); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; margin-right: 2px; }
  .tiny { padding: 4px 9px; font-size: 11.5px; }
  .qa-target { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--muted); padding: 4px 0; }
  .qa-target b { color: var(--text); }
  .qa-target code.mono { background: var(--accent-soft); color: var(--accent); border-radius: 4px; padding: 1px 6px; font-family: ui-monospace, monospace; font-size: 11px; }
  .qa-target .ep { color: var(--faint); }
  .muted { color: var(--muted); font-size: 12.5px; padding: 4px 0 0; }
  .gate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .gate { border: 1px solid var(--line); padding: 6px 8px; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; }
  .gate-name { font-size: 11.5px; color: var(--muted); }
  .gate-score { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .gate-bar { grid-column: 1 / -1; height: 2px; background: var(--line); border-radius: 2px; overflow: hidden; }
  .gate-bar i { display: block; height: 100%; background: var(--muted); }
  .gate.pass .gate-score, .gate.pass .gate-bar i { color: var(--ok); background: var(--ok); }
  .gate.warn .gate-score { color: var(--warn); } .gate.warn .gate-bar i { background: var(--warn); }
  .gate.fail .gate-score { color: var(--bad); } .gate.fail .gate-bar i { background: var(--bad); }
  .gate.pass .gate-score { background: none; }
  .issues { margin-top: 4px; display: grid; }
  .issues-head { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--faint); font-weight: 800; padding-bottom: 4px; }
  .issue { border-top: 1px solid var(--line); padding: 8px 0; }
  .issue-top { display: flex; align-items: center; gap: 8px; }
  .sev { font-size: 9.5px; text-transform: uppercase; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
  .sev.fail { color: var(--bad); background: var(--bad-soft); }
  .sev.warn { color: var(--warn); background: var(--warn-soft); }
  .sev.info { color: var(--accent-2); background: var(--accent-2-soft); }
  .issue-title { font-size: 12.5px; flex: 1; }
  .loc { padding: 1px 6px; font-size: 10.5px; font-family: ui-monospace, monospace; background: var(--accent-soft); border: 0; border-radius: 4px; color: var(--accent); }
  .issue-msg { font-size: 11.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
  .issue-act { font-size: 11.5px; color: var(--accent-2); margin-top: 4px; }
  .issue-buttons { display: flex; gap: 6px; margin-top: 6px; }
  .mini { padding: 3px 8px; font-size: 11px; }
</style>
