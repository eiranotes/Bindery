<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import type { AgentOutputMode, AgentProvider, CanonViolationPolicy, DraftKind, ParagraphSpacing } from '$lib/stores/settingsStore';
  import { CREATIVITY_LABEL, draftParamsStore } from '$lib/stores/draftParamsStore';
  import type { Creativity } from '$lib/stores/draftParamsStore';
  import { uiStore } from '$lib/stores/uiStore';
  import { toasts } from '$lib/stores/toastStore';
  import { testAgentCli } from '$lib/api/commands';

  type SectionId = 'general' | 'editor' | 'writing' | 'aiRunner' | 'aiDefaults' | 'fullCompose' | 'context' | 'codex' | 'snapshots' | 'developer';

  const sections: Array<{ id: SectionId; label: string; hint: string }> = [
    { id: 'general', label: 'General', hint: '앱 기본값' },
    { id: 'editor', label: 'Editor', hint: '원고 지면' },
    { id: 'writing', label: 'Writing', hint: '입력 보조' },
    { id: 'aiRunner', label: 'AI Runner', hint: 'CLI 연결' },
    { id: 'aiDefaults', label: 'AI Defaults', hint: '초안 기본값' },
    { id: 'fullCompose', label: 'Full Compose', hint: '회차 작성 정책' },
    { id: 'context', label: 'Context', hint: '기억 주입' },
    { id: 'codex', label: 'Codex', hint: '언급 표시' },
    { id: 'snapshots', label: 'Snapshots', hint: '보존 정책' },
    { id: 'developer', label: 'Developer', hint: '디버그' }
  ];

  const providerOptions: Array<[AgentProvider, string]> = [
    ['codex', 'Codex CLI'],
    ['antigravity', 'Antigravity CLI'],
    ['gemini', 'Gemini CLI'],
    ['custom', '직접 설정']
  ];
  const outputOptions: Array<[AgentOutputMode, string]> = [
    ['stdout', '터미널 출력(stdout)'],
    ['file', '파일로 받기']
  ];
  const lengthOptions: Array<[number, string]> = [[0, '자동'], [1500, '약 1,500자'], [3000, '약 3,000자'], [5000, '약 5,000자'], [8000, '약 8,000자']];
  const creativityOptions = Object.keys(CREATIVITY_LABEL) as Creativity[];
  const draftKindOptions: Array<[DraftKind, string]> = [['draft', '초안'], ['continue', '이어쓰기'], ['rewrite', '다시쓰기']];
  const paragraphSpacingOptions: Array<[ParagraphSpacing, string]> = [['compact', '촘촘하게'], ['normal', '보통'], ['relaxed', '여유 있게']];
  const policyOptions: Array<[CanonViolationPolicy, string]> = [['warn', '경고'], ['block', '차단']];

  let active: SectionId = 'editor';
  let testing = false;
  let testResult = '';
  let testOk: boolean | null = null;

  $: activeInfo = sections.find((section) => section.id === active) ?? sections[0];
  $: if ($uiStore.prefsOpen && $uiStore.prefsSection && sections.some((section) => section.id === $uiStore.prefsSection)) {
    active = $uiStore.prefsSection as SectionId;
  }

  function close() {
    uiStore.update((s) => ({ ...s, prefsOpen: false, prefsSection: null }));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  async function runConnectionTest() {
    testing = true;
    const result = await testAgentCli($settingsStore.agentCliPath, $settingsStore.agentProvider, $settingsStore.agentOutputMode);
    testOk = result.ok;
    testResult = result.ok ? result.stdout : result.stderr || '응답 없음';
    testing = false;
    toasts.push(result.ok ? 'AI 실행기 응답 확인' : 'AI 실행기 연결 실패', result.ok ? 'ok' : 'bad');
  }

  async function copySettings() {
    await navigator.clipboard?.writeText(JSON.stringify($settingsStore, null, 2));
    toasts.push('환경설정 JSON을 클립보드에 복사했습니다', 'ok');
  }

  function importSettings() {
    const raw = window.prompt('환경설정 JSON을 붙여넣으세요');
    if (!raw) return;
    try {
      settingsStore.update((current) => ({ ...current, ...JSON.parse(raw), version: 2 }));
      toasts.push('환경설정을 가져왔습니다', 'ok');
    } catch {
      toasts.push('JSON 형식이 올바르지 않습니다', 'bad');
    }
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $uiStore.prefsOpen}
  <div class="pref-backdrop">
    <button class="pref-close-area" aria-label="닫기" on:click={close}></button>
    <div class="pref" role="dialog" aria-modal="true" aria-label="환경설정">
      <header class="pref-head">
        <div>
          <span class="eyebrow">환경설정</span>
          <h2>{activeInfo.label}</h2>
          <p>{activeInfo.hint}</p>
        </div>
        <button class="ghost" on:click={close}>닫기</button>
      </header>

      <div class="pref-layout">
        <nav class="pref-nav" aria-label="환경설정 섹션">
          {#each sections as section}
            <button class:on={active === section.id} on:click={() => (active = section.id)}>
              <b>{section.label}</b>
              <span>{section.hint}</span>
            </button>
          {/each}
        </nav>

        <section class="pref-panel">
          {#if active === 'general'}
            <div class="setting-group">
              <h3>앱 기본</h3>
              <p>Bindery는 로컬 프로젝트 폴더를 원천 데이터로 사용합니다. 화면별 세부 데이터는 전용 스튜디오에서 다룹니다.</p>
              <div class="inline-actions">
                <button class="ghost" on:click={copySettings}>설정 JSON 복사</button>
                <button class="ghost" on:click={importSettings}>설정 JSON 가져오기</button>
              </div>
            </div>
          {:else if active === 'editor'}
            <div class="setting-group">
              <h3>원고 지면</h3>
              <label class="pref-row">
                <span>본문 폰트</span>
                <select bind:value={$settingsStore.editorFont}>
                  <option value="serif">바탕</option>
                  <option value="gothic">고딕</option>
                </select>
              </label>
              <label class="pref-row">
                <span>글자 크기</span>
                <input type="number" min="13" max="22" bind:value={$settingsStore.editorFontSize} />
              </label>
              <label class="pref-row">
                <span>줄간격</span>
                <input type="number" min="1.4" max="2.6" step="0.1" bind:value={$settingsStore.editorLineHeight} />
              </label>
              <label class="pref-row">
                <span>행 폭</span>
                <input type="number" min="48" max="88" bind:value={$settingsStore.editorMeasureCh} />
              </label>
              <label class="pref-row">
                <span>문단 간격</span>
                <select bind:value={$settingsStore.paragraphSpacing}>
                  {#each paragraphSpacingOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row check">
                <span>문단 들여쓰기</span>
                <input type="checkbox" bind:checked={$settingsStore.paragraphIndent} />
              </label>
              <label class="pref-row check">
                <span>줄 번호</span>
                <input type="checkbox" bind:checked={$settingsStore.showLineNumbers} />
              </label>
              <label class="pref-row check">
                <span>공백 제외 글자수</span>
                <input type="checkbox" bind:checked={$settingsStore.showCharacterCountNoSpaces} />
              </label>
              <label class="pref-row check">
                <span>단어수 보조 표시</span>
                <input type="checkbox" bind:checked={$settingsStore.showWordCount} />
              </label>
            </div>
          {:else if active === 'writing'}
            <div class="setting-group">
              <h3>집필 경험</h3>
              <label class="pref-row check">
                <span>자동 저장</span>
                <input type="checkbox" bind:checked={$settingsStore.autosave} />
              </label>
              <label class="pref-row">
                <span>자동 저장 지연</span>
                <input type="number" min="300" max="10000" step="100" bind:value={$settingsStore.autosaveDelayMs} />
              </label>
              <label class="pref-row check">
                <span>스마트 입력</span>
                <input type="checkbox" bind:checked={$settingsStore.smartInput} />
              </label>
              <label class="pref-row check">
                <span>스마트 따옴표</span>
                <input type="checkbox" bind:checked={$settingsStore.smartQuotes} />
              </label>
              <label class="pref-row check">
                <span>대시 자동 대치</span>
                <input type="checkbox" bind:checked={$settingsStore.autoReplaceDash} />
              </label>
              <label class="pref-row check">
                <span>화살표 자동 대치</span>
                <input type="checkbox" bind:checked={$settingsStore.autoReplaceArrow} />
              </label>
              <label class="pref-row check">
                <span>말줄임 자동 대치</span>
                <input type="checkbox" bind:checked={$settingsStore.autoReplaceEllipsis} />
              </label>
              <label class="pref-row">
                <span>작가 주석 접두어</span>
                <input bind:value={$settingsStore.commentPrefix} />
              </label>
              <label class="pref-row check">
                <span>타자기 스크롤 기본값</span>
                <input type="checkbox" bind:checked={$settingsStore.typewriterScroll} />
              </label>
              <label class="pref-row check">
                <span>포커스 모드 기본값</span>
                <input type="checkbox" bind:checked={$settingsStore.focusModeDefault} />
              </label>
            </div>
          {:else if active === 'aiRunner'}
            <div class="setting-group">
              <h3>AI 실행기</h3>
              <label class="pref-row">
                <span>실행기</span>
                <select bind:value={$settingsStore.agentProvider}>
                  {#each providerOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row">
                <span>명령어</span>
                <input bind:value={$settingsStore.agentCliPath} placeholder="codex 또는 /opt/homebrew/bin/codex" />
              </label>
              <label class="pref-row">
                <span>출력 방식</span>
                <select bind:value={$settingsStore.agentOutputMode}>
                  {#each outputOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row">
                <span>novelctl</span>
                <input bind:value={$settingsStore.novelctlPath} placeholder="novelctl" />
              </label>
              <label class="pref-row">
                <span>기본 제한 시간</span>
                <input type="number" min="30" max="900" step="10" bind:value={$settingsStore.agentDefaultTimeoutSec} />
              </label>
              <label class="pref-row">
                <span>테스트 인자</span>
                <input bind:value={$settingsStore.agentTestCommand} />
              </label>
              <div class="inline-actions">
                <button class="primary" on:click={runConnectionTest} disabled={testing}>{testing ? '확인 중...' : '연결 테스트'}</button>
                {#if testOk !== null}<span class="test-state" class:ok={testOk} class:bad={!testOk}>{testOk ? '응답 확인됨' : '실패'}</span>{/if}
              </div>
              {#if testResult}<pre class="test-console">{testResult}</pre>{/if}
              <p class="path-note">임시 출력 폴더: <code>.bindery/tmp/agent</code></p>
            </div>
          {:else if active === 'aiDefaults'}
            <div class="setting-group">
              <h3>AI 기본값</h3>
              <label class="pref-row">
                <span>기본 분량</span>
                <select bind:value={$draftParamsStore.lengthTarget}>
                  {#each lengthOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row">
                <span>기본 창의성</span>
                <select bind:value={$draftParamsStore.creativity}>
                  {#each creativityOptions as value}<option value={value}>{CREATIVITY_LABEL[value]}</option>{/each}
                </select>
              </label>
              <label class="pref-row">
                <span>기본 후보 종류</span>
                <select bind:value={$settingsStore.aiDefaultDraftKind}>
                  {#each draftKindOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row">
                <span>후보 개수</span>
                <input type="number" min="1" max="4" bind:value={$settingsStore.aiDefaultCandidateCount} />
              </label>
              <label class="pref-row">
                <span>프롬프트 예산</span>
                <input type="number" min="6000" max="64000" step="1000" bind:value={$settingsStore.maxPromptChars} />
              </label>
              <label class="pref-row check"><span>컨텍스트 팩 포함</span><input type="checkbox" bind:checked={$settingsStore.autoIncludeContextPack} /></label>
              <label class="pref-row check"><span>문체 지침 포함</span><input type="checkbox" bind:checked={$settingsStore.autoIncludeStyleGuide} /></label>
              <label class="pref-row check"><span>QA 포함</span><input type="checkbox" bind:checked={$settingsStore.autoIncludeQA} /></label>
              <label class="pref-row check"><span>수정 계획 포함</span><input type="checkbox" bind:checked={$settingsStore.autoIncludeRevisionPlan} /></label>
              <label class="pref-row check"><span>반복 리포트 포함</span><input type="checkbox" bind:checked={$settingsStore.autoIncludeRepetitionReport} /></label>
              <label class="pref-row wide">
                <span>기본 추가 지시</span>
                <textarea rows="3" bind:value={$draftParamsStore.notes} placeholder="예: 현재 회차는 주인공 시점 유지"></textarea>
              </label>
            </div>
          {:else if active === 'fullCompose'}
            <div class="setting-group">
              <h3>Full Compose 정책</h3>
              <label class="pref-row check"><span>전체 회차 작성 허용</span><input type="checkbox" bind:checked={$settingsStore.fullComposeEnabled} /></label>
              <label class="pref-row check"><span>Preflight 필수</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRequirePreflight} /></label>
              <label class="pref-row check"><span>회차 플롯 필수</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRequireEpisodePlot} /></label>
              <label class="pref-row check"><span>바이블 필수</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRequireBible} /></label>
              <label class="pref-row check"><span>기억 팩 필수</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRequireMemoryPack} /></label>
              <label class="pref-row check"><span>새 인물 허용</span><input type="checkbox" bind:checked={$settingsStore.fullComposeAllowNewCharacters} /></label>
              <label class="pref-row check"><span>새 설정 허용</span><input type="checkbox" bind:checked={$settingsStore.fullComposeAllowNewSettings} /></label>
              <label class="pref-row">
                <span>설정 충돌 정책</span>
                <select bind:value={$settingsStore.fullComposeCanonViolationPolicy}>
                  {#each policyOptions as [value, label]}<option value={value}>{label}</option>{/each}
                </select>
              </label>
              <label class="pref-row check"><span>작성 후 분석</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRunAnalyze} /></label>
              <label class="pref-row check"><span>작성 후 QA</span><input type="checkbox" bind:checked={$settingsStore.fullComposeRunQA} /></label>
              <label class="pref-row check"><span>작성 후 요약</span><input type="checkbox" bind:checked={$settingsStore.fullComposeGenerateSummary} /></label>
              <label class="pref-row check"><span>기억 델타 생성</span><input type="checkbox" bind:checked={$settingsStore.fullComposeGenerateMemoryDelta} /></label>
            </div>
          {:else if active === 'context'}
            <div class="setting-group">
              <h3>Context / Memory</h3>
              <label class="pref-row check"><span>컨텍스트 자동 구성</span><input type="checkbox" bind:checked={$settingsStore.contextAutoBuild} /></label>
              <label class="pref-row">
                <span>이전 요약 수</span>
                <input type="number" min="0" max="5" bind:value={$settingsStore.contextPreviousSummariesCount} />
              </label>
              <label class="pref-row check"><span>현재 arc 요약 포함</span><input type="checkbox" bind:checked={$settingsStore.contextIncludeArcSummary} /></label>
              <label class="pref-row check"><span>열린 떡밥 포함</span><input type="checkbox" bind:checked={$settingsStore.contextIncludeUnresolvedThreads} /></label>
              <label class="pref-row check"><span>인물 상태 포함</span><input type="checkbox" bind:checked={$settingsStore.contextIncludeCharacterState} /></label>
              <label class="pref-row check"><span>기억 델타 검토 필수</span><input type="checkbox" bind:checked={$settingsStore.contextMemoryDeltaReviewRequired} /></label>
              <label class="pref-row"><span>바이블 예산</span><input type="number" min="1000" max="20000" step="500" bind:value={$settingsStore.contextBudgetBibleChars} /></label>
              <label class="pref-row"><span>요약 예산</span><input type="number" min="1000" max="16000" step="500" bind:value={$settingsStore.contextBudgetSummariesChars} /></label>
              <label class="pref-row"><span>기억 예산</span><input type="number" min="1000" max="16000" step="500" bind:value={$settingsStore.contextBudgetMemoryChars} /></label>
              <label class="pref-row"><span>플롯 예산</span><input type="number" min="1000" max="12000" step="500" bind:value={$settingsStore.contextBudgetPlotChars} /></label>
              <label class="pref-row"><span>문체 예산</span><input type="number" min="500" max="8000" step="250" bind:value={$settingsStore.contextBudgetStyleChars} /></label>
            </div>
          {:else if active === 'codex'}
            <div class="setting-group">
              <h3>Codex 표시</h3>
              <label class="pref-row check"><span>설정 언급 표시</span><input type="checkbox" bind:checked={$settingsStore.showMentions} /></label>
              <label class="pref-row check"><span>호버 카드</span><input type="checkbox" bind:checked={$settingsStore.showHoverCards} /></label>
              <label class="pref-row check"><span>위키 링크 제안</span><input type="checkbox" bind:checked={$settingsStore.autoSuggestWikiLinks} /></label>
              <label class="pref-row check"><span>이미 링크된 언급 무시</span><input type="checkbox" bind:checked={$settingsStore.ignoreAlreadyLinked} /></label>
              <label class="pref-row"><span>별칭 최소 길이</span><input type="number" min="1" max="6" bind:value={$settingsStore.minAliasLength} /></label>
              <label class="pref-row"><span>신뢰도 임계값</span><input type="number" min="0" max="1" step="0.05" bind:value={$settingsStore.confidenceThreshold} /></label>
            </div>
          {:else if active === 'snapshots'}
            <div class="setting-group">
              <h3>스냅샷 / 저장</h3>
              <label class="pref-row check"><span>후보 적용 전 스냅샷</span><input type="checkbox" bind:checked={$settingsStore.snapshotBeforeCandidateApply} /></label>
              <label class="pref-row check"><span>전체 작성 전 스냅샷</span><input type="checkbox" bind:checked={$settingsStore.snapshotBeforeFullEpisodeCompose} /></label>
              <label class="pref-row check"><span>기억 델타 적용 전 스냅샷</span><input type="checkbox" bind:checked={$settingsStore.snapshotBeforeMemoryDeltaApply} /></label>
              <label class="pref-row"><span>파일별 최대 스냅샷</span><input type="number" min="5" max="500" bind:value={$settingsStore.maxSnapshotsPerFile} /></label>
              <label class="pref-row check"><span>오래된 스냅샷 정리</span><input type="checkbox" bind:checked={$settingsStore.pruneOldSnapshots} /></label>
            </div>
          {:else if active === 'developer'}
            <div class="setting-group">
              <h3>Developer / Debug</h3>
              <label class="pref-row check"><span>데모 모드</span><input type="checkbox" bind:checked={$settingsStore.mockMode} /></label>
              <label class="pref-row check"><span>프롬프트 미리보기 기본 표시</span><input type="checkbox" bind:checked={$settingsStore.showPromptPreviewByDefault} /></label>
              <label class="pref-row check"><span>에이전트 임시 파일 보존</span><input type="checkbox" bind:checked={$settingsStore.keepAgentTempFiles} /></label>
              <label class="pref-row check"><span>작업 콘솔 자세히</span><input type="checkbox" bind:checked={$settingsStore.verboseJobConsole} /></label>
              <p class="path-note">데모 모드는 실제 Tauri 런타임에서도 클라이언트 mock 응답을 사용합니다.</p>
            </div>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .pref-backdrop {
    position: fixed;
    inset: 0;
    z-index: 180;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: color-mix(in srgb, var(--bg) 34%, transparent);
  }
  .pref-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .pref {
    position: relative;
    width: min(900px, 96vw);
    max-height: min(760px, 92vh);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    background: var(--pop);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
  }
  .pref-head {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 16px;
    padding: 16px 18px 14px;
    border-bottom: 1px solid var(--line);
  }
  .pref-head h2 { margin: 3px 0 4px; font-size: 20px; line-height: 1.15; }
  .pref-head p { margin: 0; color: var(--faint); font-size: 12px; }
  .pref-layout {
    min-height: 0;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
  }
  .pref-nav {
    min-height: 0;
    overflow: auto;
    padding: 10px;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
  }
  .pref-nav button {
    width: 100%;
    display: grid;
    gap: 3px;
    text-align: left;
    padding: 10px 9px;
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
  }
  .pref-nav button.on { background: var(--accent-soft); color: var(--text); border-radius: var(--r-sm); border-bottom-color: transparent; }
  .pref-nav b { font-size: 12.5px; }
  .pref-nav span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--faint); font-size: 11px; }
  .pref-panel { min-height: 0; overflow: auto; padding: 16px 18px 22px; }
  .setting-group { display: grid; gap: 0; max-width: 680px; }
  .setting-group h3 { margin: 0 0 8px; font-size: 15px; line-height: 1.25; }
  .setting-group p { margin: 0 0 12px; color: var(--muted); line-height: 1.6; }
  .pref-row {
    display: grid;
    grid-template-columns: minmax(128px, 168px) minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 9px 0;
    border-top: 1px solid var(--line);
  }
  .pref-row > span {
    color: var(--faint);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .pref-row input,
  .pref-row select,
  .pref-row textarea { width: 100%; min-width: 0; }
  .pref-row textarea {
    resize: vertical;
    color: var(--text);
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 7px 10px;
    line-height: 1.5;
  }
  .pref-row.check input { justify-self: start; width: 15px; height: 15px; }
  .pref-row.wide { align-items: start; }
  .inline-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
  .test-state { color: var(--muted); font-size: 12px; }
  .test-state.ok { color: var(--ok); }
  .test-state.bad { color: var(--bad); }
  .test-console {
    max-height: 150px;
    overflow: auto;
    margin: 0 0 12px;
    padding: 10px 12px;
    background: var(--terminal);
    color: var(--term-text);
    border-radius: var(--r-sm);
    font-size: 11.5px;
    line-height: 1.5;
  }
  .path-note { margin: 8px 0 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .path-note code { color: var(--muted); }
  @media (max-width: 760px) {
    .pref { max-height: 94vh; }
    .pref-layout { grid-template-columns: 1fr; }
    .pref-nav {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .pref-nav button { width: auto; min-width: 132px; border: 1px solid var(--line); border-radius: var(--r-sm); }
    .pref-row { grid-template-columns: 1fr; gap: 6px; }
  }
</style>
