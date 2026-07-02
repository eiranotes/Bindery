# CodeMirror Extension Implementation Plan

## Extensions

1. `frontmatterExtension`
2. `wikiLinkCompletion`
3. `dynamicMentionDecoration`
4. `qaDiagnosticsExtension`
5. `repetitionDecoration`
6. `wordCountPlugin`
7. `aiCommandMenu`

## Decoration performance

- Use `ViewPlugin` for dynamic decorations.
- Recompute only on document changes or index changes.
- For long docs, compute ranges in worker and render viewport subset.

## Korean IME caution

- Avoid aggressive transaction filters during composition.
- Debounce analysis until compositionend.
- Test macOS Korean IME heavily.
