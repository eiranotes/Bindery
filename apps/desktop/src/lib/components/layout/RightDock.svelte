<script lang="ts">
  import AIPanel from '$lib/components/ai/AIPanel.svelte';
  import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
  import SnapshotPanel from '$lib/components/snapshots/SnapshotPanel.svelte';
  import JobConsole from '$lib/components/agents/JobConsole.svelte';
  import EvidenceSummary from './EvidenceSummary.svelte';
  import { uiStore } from '$lib/stores/uiStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { settingsStore } from '$lib/stores/settingsStore';
</script>

<aside class="panel dock ai-editor-rail">
  <div class="dock-head">
    <div>
      <span class="eyebrow">AI 작업</span>
      <h2>후보를 만들고 적용</h2>
    </div>
    <span class="job-badge">{$candidateStore.candidates.length}</span>
  </div>

  <div class="agent-context">
    <span>화면</span><b>{$uiStore.centerView}</b>
    <span>실행기</span><b>{$settingsStore.agentProvider}</b>
    <span>출력</span><b>{$settingsStore.agentOutputMode}</b>
  </div>

  <div class="dock-body">
    <EvidenceSummary />
    <AIPanel />
    <details class="rail-details">
      <summary>스냅샷</summary>
      <SnapshotPanel />
    </details>
    <details class="rail-details">
      <summary>실행 기록</summary>
      <JobConsole />
    </details>
    <details class="rail-details">
      <summary>AI 연결 설정</summary>
      <SettingsPanel />
    </details>
  </div>
</aside>
