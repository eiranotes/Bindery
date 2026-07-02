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
    <h1>Bindery 작업 흐름</h1>
    <p>Bindery는 원고를 직접 쓰고 저장하는 도구입니다. AI는 별도의 <b>AI 작업</b> 화면에서 연결→바이블→실행→검토 순서로만 개입하고, 원고를 직접 수정하지 않습니다.</p>
  </section>

  <section class="workflow-line" aria-label="전체 작업 흐름">
    <div>
      <b>1</b>
      <span>프로젝트</span>
      <small>새 작품 생성 또는 기존 폴더 열기</small>
    </div>
    <div>
      <b>2</b>
      <span>집필</span>
      <small>manuscript.md를 편집하고 자동 저장</small>
    </div>
    <div>
      <b>3</b>
      <span>자료</span>
      <small>설정집(바이블)과 플롯을 분리 관리</small>
    </div>
    <div>
      <b>4</b>
      <span>AI 작업</span>
      <small>연결→바이블→실행→검토 하네스</small>
    </div>
    <div>
      <b>5</b>
      <span>내보내기</span>
      <small>스냅샷과 실행 기록 확인</small>
    </div>
  </section>

  <div class="help-grid">
    <section class="help-panel">
      <div class="section-head">
        <h2>AI 하네스 4단계</h2>
        <span>{agentState}</span>
      </div>
      <ol class="quiet-flow">
        <li><b>01 연결</b><span>Codex·Gemini 등 로컬 CLI를 등록하고 연결 테스트를 합니다. 데모 모드로 CLI 없이 흐름만 볼 수도 있습니다.</span></li>
        <li><b>02 바이블</b><span>설정집 문서를 확인합니다. 없으면 템플릿을 만들거나 바이블 없이 진행할 수 있습니다.</span></li>
        <li><b>03 실행</b><span>컨텍스트→초안 후보→표현 분석→QA→수정 계획→요약→기록 순서로 실행합니다. 프롬프트는 실행 전에 그대로 볼 수 있습니다.</span></li>
        <li><b>04 검토</b><span>후보를 원고와 비교해 필요한 문단만 적용합니다. 첫 적용 전에 원본이 자동 스냅샷됩니다.</span></li>
      </ol>
    </section>

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
          <dt>바이블이 없을 때</dt>
          <dd>AI 작업 02 단계에서 「바이블 없이 진행」을 선택하면 원고와 회차 메타데이터만으로 파이프라인을 돌립니다.</dd>
        </div>
        <div>
          <dt>AI 연결이 없을 때</dt>
          <dd>집필, 자료, 스냅샷은 모두 그대로 사용할 수 있습니다. AI 작업 01 단계에서 언제든 연결하면 됩니다.</dd>
        </div>
      </dl>
    </section>

    <section class="help-panel full">
      <div class="section-head">
        <h2>화면 역할</h2>
        <span>상단 탭 기준</span>
      </div>
      <div class="screen-map">
        <div><b>집필</b><span>일상 작업의 중심. 원고만 쓰고 저장합니다. AI 버튼이 없습니다.</span></div>
        <div><b>자료</b><span>설정집과 플롯 보드. 설정 항목은 AI 프롬프트의 바이블로 쓰입니다.</span></div>
        <div><b>AI 작업</b><span>연결→바이블→실행→검토 파이프라인 하네스. Bindery의 핵심 작업대입니다.</span></div>
        <div><b>내보내기</b><span>스냅샷과 실행 기록을 확인하고 출력 전 상태를 점검합니다.</span></div>
        <div><b>환경설정</b><span>폰트, 자동 저장 등 편집 환경. 상단 오른쪽에서 엽니다.</span></div>
      </div>
    </section>
  </div>
</div>
