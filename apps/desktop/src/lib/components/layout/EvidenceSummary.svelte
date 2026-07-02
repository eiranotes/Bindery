<script lang="ts">
  import { qaStore } from '$lib/stores/qaStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { jobStore } from '$lib/stores/jobStore';
  import { editorStore } from '$lib/stores/editorStore';

  $: verdict = $qaStore.report?.verdict ?? 'idle';
  $: score = $qaStore.report?.score ?? '-';
  $: jobsDone = $jobStore.filter((j) => j.status === 'ok').length;
  $: jobsFailed = $jobStore.filter((j) => j.status === 'failed').length;
  $: proofLine = $editorStore.path ? $editorStore.path : '원고 미선택';
  $: verdictText = verdict === 'idle' ? '대기' : verdict === 'pass' ? '통과' : verdict === 'warn' ? '주의' : '실패';
</script>

<div class="evidence-summary" aria-label="실행 증거 요약">
  <div class="terminal-card">
    <div class="term-top">
      <span class="dot red"></span><span class="dot amber"></span><span class="dot green"></span>
      <span class="term-title">Bindery 실행 요약</span>
    </div>
    <div class="term-lines">
      <div><span>› 파일</span> {proofLine}</div>
      <div><span>› 판정</span> {verdict === 'idle' ? '대기' : `${verdictText} ${score}`}</div>
      <div><span>› 후보</span> {$candidateStore.candidates.length}</div>
      <div><span>› 실행</span> 성공 {jobsDone}{#if jobsFailed} 실패 {jobsFailed}{/if}</div>
    </div>
  </div>

  <div class="proof-pills">
    <span class="proof-pill {verdict}">QA {verdictText}</span>
    <span class="proof-pill">후보 {$candidateStore.candidates.length}</span>
    <span class="proof-pill">실행 {$jobStore.length}</span>
  </div>
</div>

<style>
  .evidence-summary { display: grid; gap: 10px; }
  .terminal-card {
    border: 1px solid var(--line);
    border-radius: 16px;
    background: linear-gradient(180deg, var(--terminal), color-mix(in srgb, var(--terminal) 86%, #000 14%));
    color: var(--term-text);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .term-top { display: flex; align-items: center; gap: 6px; padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; opacity: .9; }
  .red { background: #ff6b6b; } .amber { background: #ffd166; } .green { background: #5ee6a8; }
  .term-title { margin-left: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--term-muted); }
  .term-lines { padding: 12px 14px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.75; }
  .term-lines div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .term-lines span { color: var(--term-accent); }
  .proof-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .proof-pill { border: 1px solid var(--line); border-radius: 999px; background: var(--bg-2); color: var(--muted); padding: 4px 8px; font-size: 11px; }
  .proof-pill.pass { color: var(--ok); background: var(--ok-soft); border-color: color-mix(in srgb, var(--ok) 28%, transparent); }
  .proof-pill.warn { color: var(--warn); background: var(--warn-soft); border-color: color-mix(in srgb, var(--warn) 30%, transparent); }
  .proof-pill.fail { color: var(--bad); background: var(--bad-soft); border-color: color-mix(in srgb, var(--bad) 30%, transparent); }
</style>
