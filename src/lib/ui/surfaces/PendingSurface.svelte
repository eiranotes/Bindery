<script lang="ts">
  // 보류함 - 미결정 설정 변경·세계관 확장을 한 곳에서 일괄 검토한다.
  // AI 추천(위험 낮음·중간)은 기본 체크. 체크한 항목만 반영, 나머지는 계속 보류.
  import { ctx, proposals, withBusy, toast, uiMode, mode } from '$lib/stores/app';
  import { decideItem, applyProposal, assetTargetPath, type Proposal } from '$lib/harness/proposals';

  const visible = $derived($proposals.filter((p) => p.status === 'pending' || p.status === 'partial'));

  // proposal id → 체크 상태 (기본: AI 추천)
  let checks = $state<Record<string, boolean[]>>({});

  function itemsOf(p: Proposal): Array<{ title: string; sub: string; risk: 'low' | 'medium' | 'high' | '' }> {
    return p.type === 'world-expansion'
      ? p.payload.assets.map((a) => ({ title: a.name, sub: `${a.one_line_function} → ${assetTargetPath(a)}`, risk: '' as const }))
      : p.payload.changes.map((c) => ({ title: c.summary, sub: `${c.change_type} · ${c.target_path}`, risk: c.risk }));
  }

  function recommend(p: Proposal): boolean[] {
    return p.type === 'world-expansion'
      ? p.payload.assets.map(() => true)
      : p.payload.changes.map((c) => c.risk !== 'high');
  }

  // proposal 목록이 바뀌면 체크 상태를 AI 추천값으로 초기화한다.
  $effect(() => {
    for (const p of visible) {
      if (!checks[p.id] || checks[p.id].length !== p.decisions.length) {
        checks[p.id] = p.decisions.map((d, i) => (d === 'approved' ? true : d === 'rejected' ? false : recommend(p)[i]));
      }
    }
  });

  async function applyChecked(p: Proposal) {
    const list = checks[p.id] ?? recommend(p);
    const approved = list.filter(Boolean).length;
    if (!approved) {
      toast('체크된 항목이 없습니다. 반영 없이 보류를 유지합니다.', 'info');
      return;
    }
    await withBusy('보류함 반영', async () => {
      let next = p;
      for (let i = 0; i < list.length; i++) {
        next = decideItem(next, i, list[i] ? 'approved' : 'pending');
      }
      await applyProposal(ctx(), next);
      toast(`${approved}건 반영됨 (대상 파일 스냅샷 보존). 체크 해제 항목은 계속 보류됩니다.`, 'ok');
    });
    delete checks[p.id];
  }

  async function rejectAll(p: Proposal) {
    await withBusy('제안 거부', async () => {
      let next = p;
      for (let i = 0; i < p.decisions.length; i++) next = decideItem(next, i, 'rejected');
      await applyProposal(ctx(), next);
      toast('모든 항목을 거부 처리했습니다.', 'info');
    });
    delete checks[p.id];
  }

  const riskLabel: Record<string, string> = { low: '낮음', medium: '중간', high: '높음' };
</script>

<div class="surface">
  <div class="col">
    <header class="head">
      <h1>보류함</h1>
      <p class="lead">AI 제안은 여기서 멈춥니다. 체크해서 반영한 항목만 작품 설정이 되고, 반영 전 대상 파일은 자동 백업됩니다.</p>
    </header>

    {#if visible.length === 0}
      <p class="empty">보류 중인 항목이 없습니다. 회차 마감에서 발견된 설정 변경 후보가 여기에 쌓입니다.</p>
    {/if}

    {#each visible as p (p.id)}
      <section class="proposal">
        <header class="prow">
          <span class="chip {p.type === 'canon-delta' ? 'warn' : 'info'}">{p.type === 'canon-delta' ? '설정 변경' : '세계관 추가'}</span>
          <b>{p.type === 'canon-delta' ? `${p.episode}에서 발견` : '작품 준비 단계'}</b>
          <span class="dim">{new Date(p.createdAt).toLocaleDateString()} · {itemsOf(p).length}건</span>
        </header>
        <div class="check">
          {#each itemsOf(p) as item, i}
            <label>
              <input
                type="checkbox"
                checked={checks[p.id]?.[i] ?? false}
                onchange={(e) => {
                  const list = [...(checks[p.id] ?? recommend(p))];
                  list[i] = (e.currentTarget as HTMLInputElement).checked;
                  checks[p.id] = list;
                }}
              />
              {#if item.risk}<span class="chip {item.risk === 'high' ? 'bad' : item.risk === 'medium' ? 'warn' : 'ok'}">{riskLabel[item.risk]}</span>{/if}
              <span class="title">{item.title}</span>
              <span class="dim sub">{item.sub}</span>
            </label>
          {/each}
        </div>
        <div class="row">
          <button class="primary" onclick={() => applyChecked(p)}>체크한 항목만 반영</button>
          <button class="quiet" onclick={() => rejectAll(p)}>모두 거부</button>
        </div>
      </section>
    {/each}

    {#if $uiMode === 'advanced'}
      <p class="dim foot">patch 원문·개별 승인 이력은 <button class="quiet inlinebtn" onclick={() => mode.set('canon')}>제안·정사 화면(설계자)</button>에서 볼 수 있습니다.</p>
    {/if}
  </div>
</div>

<style>
  .surface { padding: 30px 32px; }
  .col { max-width: 760px; margin: 0 auto; display: grid; gap: 20px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .lead { margin: 4px 0 0; color: var(--muted); }
  .proposal { display: grid; gap: 10px; border-top: 1px solid var(--line-strong); padding-top: 12px; }
  .prow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .check { display: grid; border-top: 1px solid var(--line); }
  .check label { display: flex; gap: 10px; align-items: baseline; padding: 9px 4px; border-bottom: 1px solid var(--line); font-size: 13px; flex-wrap: wrap; }
  .check .title { font-weight: 500; }
  .check .sub { font-size: 11.5px; font-family: var(--mono); }
  .row { display: flex; gap: 8px; align-items: center; }
  .foot { font-size: 12px; }
  .inlinebtn { padding: 0 4px; font-size: 12px; text-decoration: underline; }
</style>
