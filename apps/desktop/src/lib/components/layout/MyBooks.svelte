<script lang="ts">
  import { createProjectFromSourceIntake, createProjectIntoWorkspace, openProjectIntoWorkspace } from '$lib/actions/project';
  import { projectStore } from '$lib/stores/projectStore';
  import { themeStore, toggleTheme } from '$lib/stores/themeStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { toasts } from '$lib/stores/toastStore';
  import { extractSourceDocumentText } from '$lib/domain/documentText';

  type StartMode = 'create' | 'intake' | 'open' | 'sample';

  let mode: StartMode = 'create';
  let loading: StartMode | null = null;
  let title = '새 작품';
  let author = '';
  let basePath = '~/Documents/Bindery Projects';
  let openPath = 'sample-project';
  let sourceText = '';
  let sourceFileName = '';
  let useAgentRefinement = true;

  const providerLabel: Record<string, string> = {
    codex: 'Codex',
    antigravity: 'Antigravity',
    gemini: 'Gemini',
    custom: '직접 설정'
  };
  const outputLabel: Record<string, string> = { stdout: '터미널 출력', file: '파일 출력' };
  const defaultCommandProviders = new Set(['codex', 'antigravity', 'gemini']);

  $: agentName = providerLabel[$settingsStore.agentProvider] ?? $settingsStore.agentProvider;
  $: agentReady =
    !$settingsStore.mockMode && (Boolean($settingsStore.agentCliPath?.trim() || $settingsStore.geminiCliPath?.trim()) || defaultCommandProviders.has($settingsStore.agentProvider));
  $: sourceChars = sourceText.trim().length;
  $: sourceLines = sourceText.trim() ? sourceText.trim().split(/\r?\n/).length : 0;

  async function openExisting(pathArg = openPath, nextMode: StartMode = 'open') {
    const trimmed = pathArg.trim();
    if (!trimmed) {
      toasts.push('프로젝트 경로를 입력하세요', 'warn');
      return;
    }
    loading = nextMode;
    try {
      const project = await openProjectIntoWorkspace(trimmed);
      toasts.push(`작품 열림: ${project.title}`, 'ok');
    } catch (e) {
      toasts.push(`프로젝트 열기 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      loading = null;
    }
  }

  async function createNewProject() {
    if (!title.trim()) {
      toasts.push('작품 제목을 입력하세요', 'warn');
      return;
    }
    loading = 'create';
    try {
      const project = await createProjectIntoWorkspace({
        basePath,
        title,
        author,
        template: 'serial'
      });
      toasts.push(`새 작품 생성됨: ${project.title}`, 'ok');
    } catch (e) {
      toasts.push(`프로젝트 생성 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      loading = null;
    }
  }

  async function importSourceFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const extracted = await extractSourceDocumentText(file);
      sourceFileName = extracted.fileName;
      sourceText = extracted.text;
      if (title.trim() === '새 작품') {
        title = file.name.replace(/\.[^.]+$/, '').trim() || title;
      }
    } catch (e) {
      toasts.push(`문서 불러오기 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
      input.value = '';
    }
  }

  async function createFromSourceIntake() {
    if (!title.trim()) {
      toasts.push('작품 제목을 입력하세요', 'warn');
      return;
    }
    if (sourceChars < 40) {
      toasts.push('통합 문서 내용을 조금 더 입력하세요', 'warn');
      return;
    }
    loading = 'intake';
    try {
      const project = await createProjectFromSourceIntake({
        basePath,
        title,
        author,
        template: 'serial',
        sourceText,
        sourceFileName: sourceFileName || undefined,
        useAgentRefinement: useAgentRefinement && agentReady
      });
      toasts.push(`${useAgentRefinement && agentReady ? 'AI 문맥 분해' : '로컬 분해'} 완료: ${project.title}`, 'ok');
    } catch (e) {
      toasts.push(`통합 문서 시작 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      loading = null;
    }
  }
</script>

<section class="my-books start-screen">
  <header class="my-books-top">
    <div class="logo big"><span class="logo-mark"></span><span>Bindery</span></div>
    <div class="books-actions">
      <span class="agent-pill">{agentName}: {agentReady ? '연결됨' : '미설정'}</span>
      <button class="ghost" on:click={toggleTheme}>{$themeStore === 'light' ? '어둡게' : '밝게'}</button>
    </div>
  </header>

  <main class="start-layout">
    <section class="start-primary">
      <div class="start-heading">
        <span class="eyebrow">시작</span>
        <h1>작품을 만들고 바로 씁니다</h1>
        <p>처음 켜면 프로젝트부터 정합니다. 설정이 없어도 새 원고를 만들 수 있고, AI는 필요할 때 별도 작업 화면에서 연결합니다.</p>
      </div>

      <div class="start-switch" role="tablist" aria-label="시작 방식">
        <button class:on={mode === 'create'} on:click={() => (mode = 'create')}>새 작품</button>
        <button class:on={mode === 'intake'} on:click={() => (mode = 'intake')}>통합 문서</button>
        <button class:on={mode === 'open'} on:click={() => (mode = 'open')}>기존 폴더</button>
        <button class:on={mode === 'sample'} on:click={() => (mode = 'sample')}>샘플</button>
      </div>

      {#if mode === 'create'}
        <form class="start-form" on:submit|preventDefault={createNewProject}>
          <label>
            <span>작품 제목</span>
            <input bind:value={title} autocomplete="off" placeholder="예: 서리 항구의 연금술사" />
          </label>
          <label>
            <span>작성자</span>
            <input bind:value={author} autocomplete="off" placeholder="비워두면 미정으로 저장" />
          </label>
          <label class="wide">
            <span>저장 폴더</span>
            <input bind:value={basePath} autocomplete="off" placeholder="~/Documents/Bindery Projects" />
          </label>
          <div class="start-command">
            <button class="primary" type="submit" disabled={loading !== null}>{loading === 'create' ? '생성 중...' : '새 작품 만들기'}</button>
            <span>기본 원고, 설정집, 플롯, 메모 파일을 함께 만듭니다.</span>
          </div>
        </form>
      {:else if mode === 'intake'}
        <form class="start-form intake-form" on:submit|preventDefault={createFromSourceIntake}>
          <label>
            <span>작품 제목</span>
            <input bind:value={title} autocomplete="off" placeholder="예: 서리 항구의 연금술사" />
          </label>
          <label>
            <span>작성자</span>
            <input bind:value={author} autocomplete="off" placeholder="비워두면 미정으로 저장" />
          </label>
          <label class="wide">
            <span>저장 폴더</span>
            <input bind:value={basePath} autocomplete="off" placeholder="~/Documents/Bindery Projects" />
          </label>
          <label class="wide source-box">
            <span>원천 통합 문서</span>
            <textarea bind:value={sourceText} rows="12" placeholder="아이디어, 시놉시스, 세계관 바이블, 인물 메모를 한 번에 붙여넣으세요."></textarea>
          </label>
          <div class="intake-toolbar">
            <label class="file-pick">
              <input type="file" accept=".md,.markdown,.txt,.text,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" on:change={importSourceFile} />
              <span>{sourceFileName || 'Markdown/TXT/DOCX 불러오기'}</span>
            </label>
            <span class="source-stats">{sourceChars.toLocaleString()}자 · {sourceLines.toLocaleString()}줄</span>
          </div>
          <label class="intake-option">
            <input type="checkbox" bind:checked={useAgentRefinement} disabled={!agentReady} />
            <span>AI 문맥 분해</span>
            <small>{agentReady ? '원천 문서를 읽고 의미 단위로 다시 정리합니다. 실패하면 로컬 분해를 유지합니다.' : 'AI 실행기를 연결하면 사용할 수 있습니다.'}</small>
          </label>
          <div class="start-command">
            <button class="primary" type="submit" disabled={loading !== null}>{loading === 'intake' ? '분해 중...' : '분해해서 시작'}</button>
            <span>설정집, 인물 인박스, 조직, 플롯 보드, 열린 떡밥, 원천 보관 파일을 생성합니다.</span>
          </div>
        </form>
      {:else if mode === 'open'}
        <div class="start-form single">
          <label class="wide">
            <span>프로젝트 폴더</span>
            <input bind:value={openPath} autocomplete="off" placeholder="프로젝트 경로" on:keydown={(e) => e.key === 'Enter' && openExisting()} />
          </label>
          <div class="recent-lines">
            {#if $projectStore.recent.length}
              {#each $projectStore.recent as recent}
                <button on:click={() => openExisting(recent)} title={recent}>
                  <b>{recent.split(/[\\/]/).filter(Boolean).pop() || recent}</b>
                  <span>{recent}</span>
                </button>
              {/each}
            {:else}
              <p>최근 프로젝트가 없습니다. 폴더 경로를 입력하거나 샘플로 흐름을 먼저 확인하세요.</p>
            {/if}
          </div>
          <div class="start-command">
            <button class="primary" on:click={() => openExisting()} disabled={loading !== null}>{loading === 'open' ? '여는 중...' : '프로젝트 열기'}</button>
            <span>`manuscript.md` 또는 첫 Markdown 파일을 자동으로 엽니다.</span>
          </div>
        </div>
      {:else}
        <div class="sample-line">
          <div>
            <span class="eyebrow">샘플 프로젝트</span>
            <h2>작성, 자료, AI 작업 화면을 빠르게 확인합니다</h2>
            <p>브라우저에서는 mock 데이터로, 데스크톱 앱에서는 `sample-project` 폴더를 엽니다.</p>
          </div>
          <button class="primary" on:click={() => openExisting('sample-project', 'sample')} disabled={loading !== null}>{loading === 'sample' ? '여는 중...' : '샘플 열기'}</button>
        </div>
      {/if}
    </section>

    <aside class="start-guide" aria-label="작업 흐름 안내">
      <div class="guide-status">
        <b>현재 시작 조건</b>
        <span>저장: 로컬 파일</span>
        <span>AI: {agentName} / {outputLabel[$settingsStore.agentOutputMode] ?? $settingsStore.agentOutputMode}</span>
        <span>상태: {agentReady ? 'AI 실행 가능' : '설정 없이 작성 가능'}</span>
      </div>

      <ol class="start-flow">
        <li><b>01</b><span>새 작품, 통합 문서, 기존 폴더 중 하나로 시작합니다.</span></li>
        <li><b>02</b><span>통합 문서는 설정집, 인물, 플롯으로 분리한 뒤 작성 화면으로 들어갑니다.</span></li>
        <li><b>03</b><span>원고를 저장한 뒤 필요할 때 AI 작업으로 이동합니다.</span></li>
        <li><b>04</b><span>후보 비교와 QA를 보고 직접 적용합니다.</span></li>
      </ol>

      <div class="guide-note">
        <b>설정이 없어도 되는 것</b>
        <p>프로젝트 생성, 원고 작성, 저장, 자료 정리는 바로 시작할 수 있습니다. AI 실행기는 나중에 도움말과 설정에서 연결하면 됩니다.</p>
      </div>
    </aside>
  </main>
</section>
