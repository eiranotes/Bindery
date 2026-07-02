<script lang="ts">
  import { toasts } from '$lib/stores/toastStore';
</script>

<div class="toast-host">
  {#each $toasts as t (t.id)}
    <button class="toast {t.tone}" on:click={() => toasts.dismiss(t.id)}>
      <span class="dot"></span>{t.message}
    </button>
  {/each}
</div>

<style>
  .toast-host { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 100; align-items: center; }
  .toast { display: flex; align-items: center; gap: 9px; padding: 10px 16px; border-radius: 12px; background: var(--pop); border: 1px solid var(--line); color: var(--text); font-size: 13px; box-shadow: 0 12px 40px rgba(20,18,14,.35); animation: rise .22s ease; cursor: pointer; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-2); }
  .toast.ok .dot { background: var(--ok); }
  .toast.warn .dot { background: var(--warn); }
  .toast.bad .dot { background: var(--bad); }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
</style>
