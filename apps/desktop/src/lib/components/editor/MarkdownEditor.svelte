<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { lintKeymap } from '@codemirror/lint';
  import { completionKeymap } from '@codemirror/autocomplete';
  import { searchKeymap } from '@codemirror/search';
  import EditorToolbar from './EditorToolbar.svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import { editorStore } from '$lib/stores/editorStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { qaStore } from '$lib/stores/qaStore';
  import { analysisStore } from '$lib/stores/analysisStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { writingModeStore } from '$lib/stores/writingModeStore';
  import { editorNavStore } from '$lib/stores/editorNavStore';
  import { editorTheme } from '$lib/editor';
  import { themeStore } from '$lib/stores/themeStore';
  import { smartQuotes, autoReplace } from '$lib/editor';
  import { novelExtensions, pushCodex, pushQAIssues, pushRepetition, readAICommand, wordCountField, focusModeExtension, typewriterExtension } from '$lib/editor';
  import type { WordStats } from '$lib/editor';
  import { uiStore } from '$lib/stores/uiStore';
  import { gotoStage } from '$lib/stores/pipelineStore';
  import { recordWriting } from '$lib/stores/statsStore';
  import { writeFile } from '$lib/api/commands';
  import { projectStore } from '$lib/stores/projectStore';
  import { toasts } from '$lib/stores/toastStore';

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  let ignore = false;
  const lineNumbersComp = new Compartment();
  const focusComp = new Compartment();
  const typewriterComp = new Compartment();
  const themeComp = new Compartment();
  const smartComp = new Compartment();
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  export let stats: WordStats = { words: 0, chars: 0, charsNoSpace: 0, paragraphs: 0 };

  async function saveNow() {
    const s = $editorStore;
    if (!s.path || !s.dirty) return;
    const root = $projectStore.current?.rootPath || 'sample-project';
    await writeFile(root, s.path, s.content);
    // 집필 통계: 저장 시점 단어 증가분을 날짜별로 누적
    const prevWords = s.savedContent.trim().split(/\s+/).filter(Boolean).length;
    recordWriting(root, s.wordCount - prevWords);
    editorStore.update((p) => ({ ...p, savedContent: p.content, dirty: false }));
    toasts.push('저장됨', 'ok');
  }

  function scheduleAutosave() {
    if (!$settingsStore.autosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveNow, $settingsStore.autosaveDelayMs);
  }

  // 집필 화면에서는 AI를 실행하지 않는다. 슬래시 명령은 AI 작업 화면의
  // 실행 단계로 안내만 하고, 실제 실행은 하네스에서 진행한다.
  function runAICommand(name: string) {
    gotoStage('run');
    uiStore.update((s) => ({ ...s, centerView: 'ai' }));
    toasts.push(`/${name} — AI 작업 화면에서 실행하세요`, 'info');
  }

  function buildState(doc: string) {
    return EditorState.create({
      doc,
      extensions: [
        history(),
        markdown(),
        EditorView.lineWrapping,
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        lineNumbersComp.of($settingsStore.showLineNumbers ? lineNumbers() : []),
        focusComp.of($writingModeStore.focus ? focusModeExtension : []),
        typewriterComp.of($writingModeStore.typewriter ? typewriterExtension : []),
        themeComp.of(editorTheme($themeStore)),
        smartComp.of($settingsStore.smartInput ? [smartQuotes, autoReplace] : []),
        ...novelExtensions(),
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => { saveNow(); return true; } },
          ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...lintKeymap, ...searchKeymap, indentWithTab
        ]),
        EditorView.updateListener.of((update) => {
          for (const tr of update.transactions) {
            const cmd = readAICommand(tr.effects);
            if (cmd) runAICommand(cmd);
          }
          if (update.docChanged && !ignore) {
            const content = update.state.doc.toString();
            const s = update.state.field(wordCountField);
            stats = s;
            editorStore.update((prev) => ({ ...prev, content, dirty: content !== prev.savedContent, wordCount: s.words }));
            scheduleAutosave();
          } else if (update.startState.field(wordCountField, false) !== update.state.field(wordCountField, false)) {
            stats = update.state.field(wordCountField);
          }
        })
      ]
    });
  }

  function syncAnalysis() {
    if (!view) return;
    pushCodex(view, $settingsStore.showMentions ? $codexStore.items : []);
    pushQAIssues(view, $qaStore.report?.issues ?? []);
    pushRepetition(view, $analysisStore.repetition?.terms ?? []);
  }

  onMount(() => {
    view = new EditorView({ state: buildState($editorStore.content), parent: host });
    stats = view.state.field(wordCountField);
    syncAnalysis();

    const unsubEditor = editorStore.subscribe((s) => {
      if (!view) return;
      const current = view.state.doc.toString();
      if (s.content !== current) {
        ignore = true;
        view.dispatch({ changes: { from: 0, to: current.length, insert: s.content } });
        ignore = false;
        stats = view.state.field(wordCountField);
      }
    });
    const unsubCodex = codexStore.subscribe(() => view && pushCodex(view, $settingsStore.showMentions ? $codexStore.items : []));
    const unsubQA = qaStore.subscribe(() => view && pushQAIssues(view, $qaStore.report?.issues ?? []));
    const unsubRep = analysisStore.subscribe(() => view && pushRepetition(view, $analysisStore.repetition?.terms ?? []));
    const unsubSettings = settingsStore.subscribe((s) => {
      view?.dispatch({ effects: [
        lineNumbersComp.reconfigure(s.showLineNumbers ? lineNumbers() : []),
        smartComp.reconfigure(s.smartInput ? [smartQuotes, autoReplace] : [])
      ] });
      if (view) pushCodex(view, s.showMentions ? $codexStore.items : []);
    });
    const unsubTheme = themeStore.subscribe((t) => {
      view?.dispatch({ effects: themeComp.reconfigure(editorTheme(t)) });
    });
    const unsubWriting = writingModeStore.subscribe((w) => {
      view?.dispatch({ effects: [
        focusComp.reconfigure(w.focus ? focusModeExtension : []),
        typewriterComp.reconfigure(w.typewriter ? typewriterExtension : [])
      ] });
    });
    let lastNonce = 0;
    const unsubNav = editorNavStore.subscribe((nav) => {
      if (!view || nav.line == null || nav.nonce === lastNonce) return;
      lastNonce = nav.nonce;
      const lineNo = Math.min(Math.max(1, nav.line), view.state.doc.lines);
      const line = view.state.doc.line(lineNo);
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      view.focus();
    });

    return () => { unsubEditor(); unsubCodex(); unsubQA(); unsubRep(); unsubSettings(); unsubWriting(); unsubTheme(); unsubNav(); };
  });

  onDestroy(() => { if (autosaveTimer) clearTimeout(autosaveTimer); view?.destroy(); });
</script>

<div class="editor-root">
  <EditorToolbar {stats} on:save={saveNow} />
  <div class:source={$editorStore.mode === 'source'} class:preview={$editorStore.mode === 'preview'} class="editor-grid">
    {#if $editorStore.mode !== 'preview'}<div class="cm-wrap" bind:this={host}></div>{/if}
    {#if $editorStore.mode !== 'source'}<MarkdownPreview content={$editorStore.content} />{/if}
  </div>
</div>

<style>
  .editor-root { min-height: 0; display: grid; grid-template-rows: auto 1fr; }
  .cm-wrap :global(.cm-editor) { height: 100%; }
</style>
