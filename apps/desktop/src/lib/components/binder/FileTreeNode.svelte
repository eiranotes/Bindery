<script lang="ts">
  import type { FileNode } from '$lib/types';
  import { readFile } from '$lib/api/commands';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { computeStats } from '$lib/editor';
  export let node: FileNode;
  export let depth = 0;
  let open = true;
  async function select() {
    if (node.kind === 'directory') { open = !open; return; }
    const content = await readFile($projectStore.current?.rootPath || 'sample-project', node.path);
    const stats = computeStats(content);
    fileTreeStore.update((s) => ({ ...s, selectedPath: node.path }));
    editorStore.set({ path: node.path, content, savedContent: content, dirty: false, mode: 'source', wordCount: stats.charsNoSpace });
  }
</script>

<button type="button" class="file-node" class:active={$fileTreeStore.selectedPath === node.path} style={`padding-left: ${8 + depth * 14}px`} on:click={select}>
  <span>{node.kind === 'directory' ? (open ? '▾' : '▸') : '•'}</span><span>{node.name}</span>
</button>
{#if node.kind === 'directory' && open && node.children}
  {#each node.children as child}
    <svelte:self node={child} depth={depth + 1} />
  {/each}
{/if}
