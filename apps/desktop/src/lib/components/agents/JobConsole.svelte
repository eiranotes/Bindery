<script lang="ts">
  import { jobStore } from '$lib/stores/jobStore';
</script>

<div class="card">
  <div class="kpi"><strong>실행 기록</strong><span class="badge">{$jobStore.length}건</span></div>
  <div class="console">{#if $jobStore.length === 0}아직 실행 기록이 없습니다.{:else}{#each $jobStore.slice(0,5) as job}[{job.status}] {job.label} -> {job.stdout}\n{/each}{/if}</div>
</div>
