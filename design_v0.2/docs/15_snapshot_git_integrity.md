# 15. Snapshot, Git, and Integrity

## 1. Snapshot policy

Snapshot is required before:

- AI rewrite apply
- final overwrite
- canon update apply
- scene reorder
- snapshot restore
- bulk link apply

## 2. Snapshot directory

```text
snapshots/
  ep012/
    20260701-120000-before-style-rewrite/
      manifest.json
      story/chapters/ep012/13_final.md
      story/chapters/ep012/12_revision-plan.md
```

## 3. Snapshot manifest

```json
{
  "snapshotId": "ep012_20260701_120000_before_style_rewrite",
  "scope": "episode",
  "reason": "before-style-rewrite",
  "createdAt": "2026-07-01T12:00:00+09:00",
  "files": [
    {
      "path": "story/chapters/ep012/13_final.md",
      "sha256": "..."
    }
  ]
}
```

## 4. Diff UI

Diff sources:

- current file vs snapshot
- draft vs final
- AI candidate vs current selection
- canon before/after
- Git diff

Implementation options:

- Monaco Diff Editor for file-level diff.
- diff-match-patch for inline range patch.
- CodeMirror MergeView as alternative.

## 5. Restore workflow

```text
User selects snapshot
→ app creates pre-restore snapshot
→ shows diff
→ user confirms
→ files restored
→ index rebuild
→ open tabs reload/conflict
```

## 6. Git integration

Git is optional.

Features:

- git status
- branch display
- stage selected files
- commit with generated message
- view diff
- open external Git client

Do not require Git for MVP.

## 7. Integrity check

### 7.1 Checks

| Check | Rule |
|---|---|
| stale summary | final modified after summary |
| stale QA | final modified after QA report |
| stale context | brief/canon/story-state modified after context-pack |
| missing canon delta | final exists but canon-delta absent |
| uncommitted canon update | canon-delta applied but update-log missing |
| broken wikilink | `[[...]]` target missing |
| ambiguous alias | alias maps to multiple codex items |
| snapshot hash mismatch | snapshot file hash differs from manifest |

### 7.2 UI

```text
Integrity Check
  FAIL  EP012 final changed after QA
  WARN  3 ambiguous dynamic links
  PASS  snapshots valid

[Fix] [Open] [Ignore Once]
```

## 8. Backup ZIP

Export project backup:

- include full project.
- optionally exclude `.novelctl/cache`.
- include manifest and hash list.
- option: public-safe export excluding private notes and raw prompts.
