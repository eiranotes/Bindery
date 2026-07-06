<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { EditorState, Compartment } from '@codemirror/state';
  import {
    EditorView, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter,
    keymap, lineNumbers
  } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';

  let {
    value = $bindable(''),
    compact = false,
    readonly = false
  }: {
    value: string;
    compact?: boolean;
    readonly?: boolean;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  let internalChange = false;
  const editable = new Compartment();

  const bindValue = EditorView.updateListener.of((update) => {
    if (!update.docChanged || internalChange) return;
    value = update.state.doc.toString();
  });

  function editorTheme(isCompact: boolean) {
    return EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'var(--bg-desk)',
        color: 'var(--text)',
        fontSize: isCompact ? '12.5px' : '13px',
        border: '1px solid var(--line)',
        borderRadius: '4px'
      },
      '.cm-scroller': {
        fontFamily: 'var(--mono)',
        lineHeight: isCompact ? '1.65' : '1.75'
      },
      '.cm-content': {
        padding: '10px 12px',
        caretColor: 'var(--accent)',
        minHeight: isCompact ? '240px' : '100%'
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-1)',
        color: 'var(--faint)',
        borderRight: '1px solid var(--line)'
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'var(--accent-soft)'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--accent-soft)'
      },
      '&.cm-focused': {
        outline: '2px solid var(--accent-soft)',
        borderColor: 'var(--accent)'
      }
    });
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          markdown(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          highlightActiveLine(),
          EditorView.lineWrapping,
          editable.of(EditorView.editable.of(!readonly)),
          bindValue,
          editorTheme(compact)
        ]
      })
    });
  });

  $effect(() => {
    if (!view) return;
    view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!readonly)) });
  });

  $effect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    internalChange = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    internalChange = false;
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor { height: 100%; min-height: 0; }
</style>
