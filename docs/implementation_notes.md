# Stage 3 Implementation Notes

## What changed from v0.2 design

The v0.2 design package already contained detailed Stage 1/2 artifacts. Stage 3 adds a runnable source scaffold and narrows the first implementation target to:

- browser-verifiable UI prototype,
- Svelte/Tauri source layout,
- Rust command contracts implemented as real source,
- Python `novelctl` core runnable without external dependencies,
- standalone Windows installer path through Tauri NSIS.

## Superloopy-inspired UI mapping

The requested Superloopy reference was interpreted as product/UX pattern, not source-code reuse:

| Superloopy concept | Bindery UI adaptation |
|---|---|
| evidence-first completion | right rail gates: context, draft, QA, snapshot |
| repo-local state | plan/state/log + Markdown source tree |
| crew lanes | Agent Crew panel: architect/drafter/judge/archivist |
| compact hooks | pipeline bar buttons and job console |
| artifact-backed done | output file chips and snapshot records |

## Refactoring decisions

- API calls are isolated in `src/lib/api/commands.ts`.
- Stores are file/episode/job/settings separated.
- UI can run in browser mock mode before Tauri is available.
- Tauri commands return typed JSON-compatible structs.
- Python CLI returns JSON envelopes for stable GUI consumption.

## Follow-up refactor targets

1. Replace mock command bridge with full Tauri invoke path in production build.
2. Replace static Markdown preview with a safe parser/sanitizer stack.
3. Add CodeMirror decorations for repetition and dynamic links.
4. Add patch preview and CodeMirror Merge for candidate/diff/apply.
5. Add SQLite indexer after file-source behavior is stable.
