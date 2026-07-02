<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import { uiStore } from '$lib/stores/uiStore';

  function close() {
    uiStore.update((s) => ({ ...s, prefsOpen: false }));
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $uiStore.prefsOpen}
  <div class="pref-backdrop">
    <button class="pref-close-area" aria-label="닫기" on:click={close}></button>
    <div class="pref" role="dialog" aria-modal="true" aria-label="환경설정">
      <div class="pref-head">
        <span class="eyebrow">환경설정</span>
        <button class="ghost" on:click={close}>닫기</button>
      </div>

      <div class="pref-body">
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
        <label class="pref-row check">
          <span>자동 저장</span>
          <input type="checkbox" bind:checked={$settingsStore.autosave} />
        </label>
        <label class="pref-row check">
          <span>줄 번호</span>
          <input type="checkbox" bind:checked={$settingsStore.showLineNumbers} />
        </label>
        <label class="pref-row check">
          <span>설정 언급 표시</span>
          <input type="checkbox" bind:checked={$settingsStore.showMentions} />
        </label>
        <label class="pref-row check">
          <span>스마트 입력</span>
          <input type="checkbox" bind:checked={$settingsStore.smartInput} />
        </label>
      </div>

      <p class="pref-note">AI 실행기 연결은 <b>AI 작업 → 01 연결</b> 단계에서 설정합니다.</p>
    </div>
  </div>
{/if}

<style>
  .pref-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 180; display: flex; align-items: center; justify-content: center; }
  .pref-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .pref { position: relative; width: min(420px, 92vw); background: var(--pop); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-pop); padding: 0 18px 16px; }
  .pref-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 10px; border-bottom: 1px solid var(--line); }
  .pref-body { display: grid; }
  .pref-row {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .pref-row > span { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .pref-row.check input { justify-self: start; width: 15px; height: 15px; }
  .pref-note { margin: 12px 0 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .pref-note b { color: var(--muted); }
</style>
