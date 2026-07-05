# 09. Implementation Roadmap

## Phase 0 — Static local workspace

Build without AI first:

- Project skeleton.
- Sidebar/tree/tabs/editor.
- Idea inbox.
- Asset sheet editor.
- Plotboard YAML editor.
- Episode brief and scene plan files.
- Snapshot/compare.
- Proposal folder and manual proposal review.

Exit criteria:

- A writer can move from idea to brief to scene plan to manuscript manually.

## Phase 1 — Prompt/context infrastructure

- ContextManifest builder.
- Prompt builder.
- Prompt Audit panel.
- Run/artifact ledger.
- Schema validator.
- Agent profiles.

Exit criteria:

- User can preview exactly what will be sent to AI.
- User can run dry-run prompt exports.

## Phase 2 — Local CLI AI

- CLI adapter with `-p` prompt arg profile.
- stdout/file mode.
- model/extra args in profile.
- stage outputs for idea, world, bible, plot, brief, scene plan, draft.

Exit criteria:

- AI output always lands in editable file/candidate/proposal.

## Phase 3 — Review and governance

- Candidate diff/apply.
- Prose/Fiction/Governance QA split.
- CanonDeltaProposal.
- Story License and Story Envelope gates.

Exit criteria:

- Governance block prevents unsafe apply.

## Phase 4 — Web-AI exchange

- Export exchange bundle.
- Import result.json/result.md/result.zip.
- Validate imported output.
- Create artifacts/proposals from import.

Exit criteria:

- User can use ChatGPT/Gemini/Claude web UI manually while preserving local audit trail.

## Phase 5 — Retrieval and index

- SQLite FTS.
- Asset/source metadata.
- Branch/authority filters.
- Optional vector index.
- Prompt source selection UI.

## Phase 6 — Branch/lineage and advanced planning

- Branch index.
- Branch-scoped context.
- Branch merge proposals.
- Graph/canvas relationship editing.
- Long-range arc QA.
