<script lang="ts">
  import { projectStore } from '$lib/stores/projectStore';
  import { settingsStore } from '$lib/stores/settingsStore';

  const providerLabel: Record<string, string> = {
    codex: 'Codex',
    antigravity: 'Antigravity',
    gemini: 'Gemini',
    custom: '직접 설정'
  };

  $: agentLabel = providerLabel[$settingsStore.agentProvider] ?? $settingsStore.agentProvider;
  $: agentState = $settingsStore.agentCliPath ? `${agentLabel} 연결됨` : 'AI 실행기 미설정';
  $: projectState = $projectStore.current?.hasNovelctlConfig ? '프로젝트 설정 감지됨' : '기본 구조로 작성 가능';
</script>

<div class="help-page">
  <section class="help-hero">
    <span class="eyebrow">도움말</span>
    <h1>작품 작성 흐름</h1>
    <p>Bindery는 먼저 원고를 만들고 저장하는 도구입니다. AI는 원고 옆에서 후보를 만들고 검토하는 보조 기능으로 분리됩니다.</p>
  </section>

  <section class="workflow-line" aria-label="전체 작업 흐름">
    <div>
      <b>1</b>
      <span>프로젝트</span>
      <small>새 작품 생성 또는 기존 폴더 열기</small>
    </div>
    <div>
      <b>2</b>
      <span>작성</span>
      <small>manuscript.md를 바로 편집하고 저장</small>
    </div>
    <div>
      <b>3</b>
      <span>자료</span>
      <small>설정집, 플롯, 열린 떡밥 분리 관리</small>
    </div>
    <div>
      <b>4</b>
      <span>AI 작업</span>
      <small>후보 생성, 비교, QA 결과 확인</small>
    </div>
    <div>
      <b>5</b>
      <span>검토/내보내기</span>
      <small>반복 표현, 스냅샷, 출력 준비</small>
    </div>
  </section>

  <div class="help-grid">
    <section class="help-panel">
      <div class="section-head">
        <h2>시작 상태</h2>
        <span>{projectState}</span>
      </div>
      <dl class="state-table">
        <div>
          <dt>설정이 없을 때</dt>
          <dd>시작 화면에서 제목과 저장 폴더만 입력하면 기본 원고, 설정집, 플롯, 메모 파일이 만들어집니다.</dd>
        </div>
        <div>
          <dt>기존 폴더가 있을 때</dt>
          <dd>프로젝트 열기로 폴더를 열면 `manuscript.md` 또는 첫 Markdown 파일을 자동 선택합니다.</dd>
        </div>
        <div>
          <dt>AI를 쓰기 전</dt>
          <dd>작성 화면에서 저장한 뒤 `AI 작업`으로 이동해 후보를 만들고 비교합니다.</dd>
        </div>
      </dl>
    </section>

    <section class="help-panel">
      <div class="section-head">
        <h2>AI 연결</h2>
        <span>{agentState}</span>
      </div>
      <ol class="quiet-flow">
        <li><b>원고 저장</b><span>편집기에서 현재 원고를 확정합니다.</span></li>
        <li><b>후보 생성</b><span>`AI 작업`에서 초안, 수정, 이어쓰기 중 하나를 실행합니다.</span></li>
        <li><b>비교 후 적용</b><span>후보 비교 패널에서 필요한 문단만 적용합니다.</span></li>
        <li><b>QA 확인</b><span>검토 결과와 수정 계획을 보고 다음 작성으로 돌아갑니다.</span></li>
      </ol>
    </section>

    <section class="help-panel full">
      <div class="section-head">
        <h2>화면 역할</h2>
        <span>상단 탭 기준</span>
      </div>
      <div class="screen-map">
        <div><b>작성</b><span>일상 작업의 중심. 원고를 직접 쓰고 저장합니다.</span></div>
        <div><b>자료</b><span>설정집, 플롯 보드, 떡밥 메모를 원고와 분리합니다.</span></div>
        <div><b>AI 작업</b><span>AI 후보와 근거를 확인하는 별도 작업대입니다.</span></div>
        <div><b>검토</b><span>반복 표현, QA, 수정 계획을 확인합니다.</span></div>
        <div><b>내보내기</b><span>스냅샷, 실행 기록, 출력 전 상태를 점검합니다.</span></div>
      </div>
    </section>
  </div>
</div>
