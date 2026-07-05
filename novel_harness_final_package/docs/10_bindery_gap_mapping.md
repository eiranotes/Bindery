# 10. Bindery Gap Mapping

## What Bindery already covers

| Area | Current Bindery asset | Keep? |
|---|---|---|
| Local-first project | project folder with `story/`, `canon/`, `plot/`, `notes/` | yes |
| AI connection | CLI settings, test command, native bridge | yes, but profile-unify |
| Candidate review | candidateStore, CandidateDiffPanel, hunk apply | yes |
| Snapshot safety | snapshot before apply | yes |
| Artifacts | `.bindery/artifacts` and index | yes |
| Run persistence | `.bindery/runs` run history | yes |
| Prompt preview | `assemblePrompt`, guidance sections | yes |
| Style system | style profiles, prompt capsule, score | yes |
| QA/revision | QA dashboard, revision panel | yes |

## What must be added or redesigned

| Missing/weak area | Replacement design |
|---|---|
| Idea discovery | `ideas/` workspace + idea seed prompts |
| World expansion | asset sheets + Story License + expansion proposal |
| Bible generation | asset-source assembly, not a flat template |
| Plot before draft | plot architecture, episode brief, scene plan before prose |
| Canon control | CanonDeltaProposal + approval UI |
| Branch safety | branch-index + lineage-aware context |
| Prompt audit | included/excluded source, authority, token, stale/branch warnings |
| Provider consistency | `agent-profiles.yaml` and adapter interface |
| Web AI usage | exchange bundle export/import |
| UI mental model | editable output surfaces, not isolated AI rail |
| Static-vs-AI split | static files remain useful without AI |

## Practical migration path from Bindery

1. Keep existing editor, file tree, snapshot, candidate diff, style system.
2. Add `ideas/`, `status/`, `manifest/`, expanded `world/` folders to project creation.
3. Add static UI surfaces for Ideas, World, Bible, Plot.
4. Move AI actions into each surface.
5. Introduce `agent-profiles.yaml` without removing current settings UI.
6. Add prompt audit and context manifest.
7. Add EpisodeBrief/ScenePlan stages before draft.
8. Add CanonDeltaProposal and approval desk.
9. Add web-AI exchange export/import.
10. Split QA into prose/fiction/governance.
