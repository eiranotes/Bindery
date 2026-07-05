<script lang="ts">
  // 소재 화면 — 조건 입력 → 후보 생성(inbox) → 카드 검토 → 씨앗/채택/보류/폐기.
  // 모든 카드는 ideas/ 아래 Markdown 파일이며, 버튼은 파일 이동일 뿐이다.
  import { ctx, ideas, withBusy, toast, refreshAll, mode } from '$lib/stores/app';
  import { discoverIdeas, moveIdea, triageIdeas, type IdeaFile } from '$lib/harness/ideas';
  import { exportPacket, recordImport } from '$lib/harness/exchange';
  import { previewPrompt } from '$lib/harness/runner';
  import { BLUEPRINTS } from '$lib/prompts';
  import { parseIdeaSeedBatch, type IdeaSeed } from '$lib/schemas/contracts';
  import { renderIdeaSeedFile } from '$lib/harness/ideas';
  import { LAYOUT } from '$lib/core/layout';
  import { nowIso, slugify, stamp } from '$lib/core/text';
  import type { IdeaStatus } from '$lib/core/layout';

  let criteria = $state({ genres: '', mood: '', cliches: '', readerExperience: '', avoid: '', notes: '', count: 5 });
  let statusFilter = $state<IdeaStatus>('inbox');
  let selectedPath = $state<string | null>(null);
  let triageReport = $state('');
  let showExchange = $state(false);
  let exchangePacket = $state('');
  let exchangeId = $state('');
  let importText = $state('');

  const filtered = $derived($ideas.filter((i) => i.status === statusFilter));
  const selected = $derived($ideas.find((i) => i.path === selectedPath) ?? filtered[0] ?? null);
  const statuses: Array<[IdeaStatus, string]> = [['inbox', '후보'], ['seeds', '씨앗'], ['selected', '채택'], ['discarded', '폐기']];

  function discoveryVars() {
    return {
      count: String(criteria.count),
      genres: criteria.genres || '(지정 없음)',
      mood: criteria.mood || '(지정 없음)',
      cliches: criteria.cliches || '(지정 없음)',
      readerExperience: criteria.readerExperience || '(지정 없음)',
      avoid: criteria.avoid || '(없음)',
      notes: criteria.notes || '(없음)',
      existingTitles: $ideas.map((i) => i.seed.title).join(', ') || '(없음)'
    };
  }

  async function generate() {
    const result = await withBusy('소재 발굴', () => discoverIdeas(ctx(), criteria, $ideas.map((i) => i.seed.title)));
    if (result) {
      statusFilter = 'inbox';
      toast(
        result.outcome.source === 'agent'
          ? `소재 후보 ${result.files.length}건이 ideas/inbox/에 생성됨`
          : '로컬 뼈대 1건 생성됨 — AI 실행기 연결 후 다시 실행하면 후보가 채워집니다',
        result.outcome.source === 'agent' ? 'ok' : 'warn'
      );
    }
  }

  async function move(idea: IdeaFile, to: IdeaStatus) {
    await withBusy(`소재 이동(${to})`, async () => {
      await moveIdea(ctx(), idea, to);
      toast(`「${idea.seed.title}」 → ideas/${to}/`, 'ok');
    });
  }

  async function triage() {
    const pool = $ideas.filter((i) => i.status === 'inbox' || i.status === 'seeds');
    if (pool.length < 2) {
      toast('비교할 소재가 2건 이상 필요합니다', 'warn');
      return;
    }
    const outcome = await withBusy('소재 선별 권고', () => triageIdeas(ctx(), pool, criteria.readerExperience), false);
    if (outcome) triageReport = outcome.output;
  }

  async function makePacket() {
    const prompt = previewPrompt({ blueprint: BLUEPRINTS.ideaDiscovery, vars: discoveryVars() });
    const packet = await withBusy('packet 내보내기', () => exportPacket(ctx(), 'idea-discovery', prompt), false);
    if (packet) {
      exchangePacket = packet.packet;
      exchangeId = packet.exchangeId;
      showExchange = true;
      toast(`packet 저장됨: ${packet.packetPath}`, 'ok');
    }
  }

  async function importResult() {
    const seeds = parseIdeaSeedBatch(importText, nowIso());
    if (!seeds) {
      if (exchangeId) await recordImport(ctx(), exchangeId, importText, false, 'schema validation failed');
      toast('가져오기 실패: bindery.idea_seed_batch.v1 JSON이 아닙니다', 'bad');
      return;
    }
    await withBusy('웹 AI 결과 가져오기', async () => {
      const c = ctx();
      let n = 0;
      for (const partial of seeds) {
        const id = `idea-${stamp()}-${++n}`;
        const seed: IdeaSeed = { ...partial, id, source: 'web-import', createdAt: nowIso() };
        await c.bridge.writeFile(c.root, `${LAYOUT.ideas.inbox}/${id}-${slugify(seed.title)}.md`, renderIdeaSeedFile(seed));
      }
      if (exchangeId) await recordImport(c, exchangeId, importText, true);
      toast(`웹 AI 소재 ${seeds.length}건을 inbox로 가져옴 (검증 통과)`, 'ok');
      importText = '';
      showExchange = false;
    });
  }

  async function copyPacket() {
    await navigator.clipboard.writeText(exchangePacket);
    toast('packet이 클립보드에 복사됨 — 웹 AI에 붙여넣으세요', 'ok');
  }
</script>

<div class="surface">
  <header class="head">
    <h1>소재 발굴</h1>
    <p class="dim">후보는 ideas/inbox/ 파일로 생성됩니다. 채택/보류/폐기는 폴더 이동이며 언제든 파일을 직접 수정할 수 있습니다.</p>
  </header>

  <section class="criteria">
    <span class="label">발굴 조건</span>
    <div class="form">
      <label>장르<input bind:value={criteria.genres} placeholder="현대 판타지, 미스터리…" /></label>
      <label>분위기<input bind:value={criteria.mood} placeholder="서늘한 성장담" /></label>
      <label>활용할 클리셰<input bind:value={criteria.cliches} /></label>
      <label>독자 경험<input bind:value={criteria.readerExperience} placeholder="매 화 하나의 비밀" /></label>
      <label>금지 요소<input bind:value={criteria.avoid} placeholder="회귀, 아카데미…" /></label>
      <label>후보 수<input type="number" min="1" max="10" bind:value={criteria.count} /></label>
      <label class="wide">메모<input bind:value={criteria.notes} /></label>
    </div>
    <div class="row">
      <button class="primary" onclick={generate}>소재 후보 생성</button>
      <button onclick={triage}>선별 권고 (AI)</button>
      <button onclick={makePacket}>웹 AI packet</button>
      <button class="quiet" onclick={() => (showExchange = !showExchange)}>{showExchange ? '교환 닫기' : '웹 AI 결과 가져오기'}</button>
    </div>
  </section>

  {#if showExchange}
    <section class="exchange">
      <span class="label">웹 AI 교환 — CLI 없이 ChatGPT/Claude/Gemini 웹으로 실행</span>
      {#if exchangePacket}
        <div class="row"><button onclick={copyPacket}>packet 복사</button><span class="dim">.bindery/exchange/{exchangeId}/packet.md 에도 저장됨</span></div>
      {/if}
      <textarea rows="6" bind:value={importText} placeholder="웹 AI가 돌려준 JSON 응답을 여기 붙여넣으세요"></textarea>
      <div class="row"><button class="primary" onclick={importResult} disabled={!importText.trim()}>검증 후 inbox로 등록</button></div>
    </section>
  {/if}

  <div class="board">
    <nav class="statuses">
      {#each statuses as [id, label]}
        <button class="quiet" class:on={statusFilter === id} onclick={() => { statusFilter = id; selectedPath = null; }}>
          {label} <b>{$ideas.filter((i) => i.status === id).length}</b>
        </button>
      {/each}
    </nav>

    <div class="split">
      <ul class="cards">
        {#each filtered as idea (idea.path)}
          <li>
            <button class="card quiet" class:on={selected?.path === idea.path} onclick={() => (selectedPath = idea.path)}>
              <b>{idea.seed.title}</b>
              <span>{idea.seed.hook}</span>
              <i class="src">{idea.seed.source === 'agent' ? 'AI' : idea.seed.source === 'web-import' ? '웹' : idea.seed.source === 'local' ? '뼈대' : '수동'}</i>
            </button>
          </li>
        {:else}
          <p class="empty">이 상태의 소재가 없습니다.</p>
        {/each}
      </ul>

      {#if selected}
        <article class="detail">
          <h2>{selected.seed.title}</h2>
          <p class="dim mono">{selected.path}</p>
          <dl>
            <dt>훅</dt><dd>{selected.seed.hook || '-'}</dd>
            <dt>감정 엔진</dt><dd>{selected.seed.emotional_engine || '-'}</dd>
            <dt>독자 약속</dt><dd>{selected.seed.reader_promise || '-'}</dd>
            <dt>장기 잠재력</dt><dd>{selected.seed.longform_potential || '-'}</dd>
            <dt>첫 장면</dt><dd>{selected.seed.first_scene_image || '-'}</dd>
            <dt>리스크</dt><dd>{selected.seed.risks.join(' · ') || '-'}</dd>
          </dl>
          <div class="row">
            {#if selected.status !== 'seeds'}<button onclick={() => move(selected!, 'seeds')}>씨앗으로</button>{/if}
            {#if selected.status !== 'selected'}<button class="primary" onclick={() => move(selected!, 'selected')}>채택</button>{/if}
            {#if selected.status !== 'inbox'}<button onclick={() => move(selected!, 'inbox')}>보류(inbox)</button>{/if}
            {#if selected.status !== 'discarded'}<button class="danger" onclick={() => move(selected!, 'discarded')}>폐기</button>{/if}
            <button class="quiet" onclick={() => mode.set('files')}>파일로 열기</button>
          </div>
          {#if selected.status === 'selected'}
            <p class="next">채택됨 — <button class="quiet" onclick={() => mode.set('world')}>세계관 확장으로 이동 →</button></p>
          {/if}
        </article>
      {/if}
    </div>
  </div>

  {#if triageReport}
    <section>
      <span class="label">선별 권고 (AI 의견 — 결정은 사람이)</span>
      <pre class="pre">{triageReport}</pre>
    </section>
  {/if}
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 18px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 0; }
  .criteria, .exchange { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 14px; }
  .form label { display: grid; gap: 3px; font-size: 11.5px; color: var(--muted); }
  .form .wide { grid-column: 1 / -1; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .statuses { display: flex; gap: 4px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  .statuses button.on { background: var(--accent-soft); color: var(--text); }
  .statuses b { color: var(--faint); font-weight: 650; margin-left: 3px; }
  .split { display: grid; grid-template-columns: minmax(240px, 340px) minmax(0, 1fr); gap: 20px; align-items: start; }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; max-height: 420px; overflow: auto; }
  .card {
    position: relative; display: grid; gap: 2px; width: 100%; text-align: left;
    padding: 9px 8px; border: 0; border-bottom: 1px solid var(--line); border-radius: 0;
  }
  .card b { color: var(--text); font-size: 13px; padding-right: 30px; }
  .card span { color: var(--muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .card.on { background: var(--accent-soft); }
  .card .src { position: absolute; top: 8px; right: 6px; font-style: normal; font-size: 9.5px; color: var(--faint); border: 1px solid var(--line); border-radius: 3px; padding: 0 4px; }
  .detail { display: grid; gap: 10px; align-content: start; }
  .detail h2 { margin: 0; font-size: 17px; }
  .detail dl { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 6px 12px; margin: 0; border-top: 1px solid var(--line); padding-top: 10px; }
  .detail dt { color: var(--faint); font-size: 11.5px; }
  .detail dd { margin: 0; font-size: 13px; line-height: 1.6; }
  .next { font-size: 12.5px; color: var(--ok); }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } .form { grid-template-columns: 1fr 1fr; } }
</style>
