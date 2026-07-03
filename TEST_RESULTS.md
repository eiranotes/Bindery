# TEST_RESULTS.md

## Commands

```bash
python3 -m unittest discover -s tests -v
node --experimental-strip-types tests/styleSystem.node.test.mjs
node --experimental-strip-types tests/styleAnalyzer.node.test.mjs
python3 -m compileall -q packages/novelctl-core/novelctl
npm --workspace apps/desktop run check
npm run build
python3 scripts/verify_static.py
cargo fmt --check
cargo check
Chrome DevTools visual QA at 1280/768/390 for `문체 시스템`
```

## Result

- Python unittest: 18 tests, OK.
- TypeScript smoke test: OK.
- Scene grouping smoke test: OK.
- Python compileall: OK.
- Svelte check: 0 errors, 0 warnings.
- Vite/SvelteKit production build: OK, with the existing large chunk warning.
- Static project verification: OK.
- Rust format check: OK.
- Rust cargo check: OK.
- Visual QA: PASS at 1280/768/390; no body horizontal overflow, detected overlap, or unclipped control overflow.

## Notes

- Tauri `.app`/DMG rebuild was not run in this pass because Phase 2 changed source/runtime/UI and the normal production build plus Rust checks passed.
- The Vite build still emits the known chunk-size warning for the main app chunk.
- Visual QA evidence: `.superloopy/evidence/frontend/20260703-phase2-style-system/VISUAL_QA.md`.
