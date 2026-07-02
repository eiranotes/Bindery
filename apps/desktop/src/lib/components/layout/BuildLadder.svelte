<script lang="ts">
  import { buildSteps, uiStore } from '$lib/stores/uiStore';
  import { buildLadderStore, statusTone } from '$lib/stores/buildLadderStore';
  import type { BuildStep } from '$lib/stores/uiStore';

  function setStep(step: BuildStep) {
    uiStore.update((s) => ({ ...s, centerView: step }));
  }
</script>

<nav class="build-ladder" aria-label="작품 작업 흐름">
  {#each buildSteps as step, index}
    <button
      class="ladder-step"
      class:on={$uiStore.centerView === step.id}
      class:locked={$buildLadderStore[step.id].status === 'locked'}
      on:click={() => setStep(step.id)}
      title={$buildLadderStore[step.id].note}
    >
      <span class="num">{index + 1}</span>
      <span class="copy"><b>{step.label}</b><small>{step.hint}</small></span>
      <i class="dot {statusTone($buildLadderStore[step.id].status)}"></i>
    </button>
  {/each}
</nav>
