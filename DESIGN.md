# Bindery Design System

## 1. Atmosphere / Signature

Bindery is a dense local writing workbench: warm paper, teal control points, hairline structure, and quiet Korean tool language. The UI should feel like a dependable manuscript desk, not a marketing page. It favors rails, tables, compact controls, and explicit state gates over decorative cards.

## 2. Color

All component colors trace to these CSS variables in `src/app.css`.

| Role | Variable | Light | Dark | Use |
|---|---|---:|---:|---|
| App background | `--bg` | `#f4f2ee` | `#0b0d12` | Root shell background |
| Rail background | `--bg-rail` | `#efebe4` | `#0f1219` | Left navigation and muted chips |
| Surface | `--bg-1` | `#fbf9f5` | `#10131c` | Panels, inspector, dock |
| Raised surface | `--bg-2` | `#fffefc` | `#161a26` | Inputs, hover fill |
| Desk | `--bg-desk` | `#fffdf9` | `#12141b` | Main writing area |
| Foreground | `--text` | `#2f2b26` | `#e7ecf5` | Primary text |
| Muted text | `--muted` | `#6f6a61` | `#94a3b8` | Secondary text |
| Faint text | `--faint` | `#a09a8e` | `#5c687c` | Labels, counts, metadata |
| Accent | `--accent` | `#315e63` | `#7fa3a8` | Active controls, primary buttons |
| Accent soft | `--accent-soft` | `rgba(49, 94, 99, 0.12)` | `rgba(127, 163, 168, 0.16)` | Selected rows, focus fill |
| Secondary accent | `--accent-2` | `#8b6f3d` | `#d8b46a` | Rare secondary mark only |
| Border | `--line` | `rgba(72, 66, 56, 0.13)` | `rgba(148, 163, 184, 0.14)` | Hairlines |
| Strong border | `--line-strong` | `rgba(72, 66, 56, 0.24)` | `rgba(148, 163, 184, 0.28)` | Section separators |
| Success | `--ok` | `#1f9d6b` | `#1f9d6b` | Approved, fixed, valid |
| Success soft | `--ok-soft` | `rgba(31, 157, 107, 0.12)` | `rgba(31, 157, 107, 0.12)` | Success chips and rows |
| Warning | `--warn` | `#b07c10` | `#b07c10` | Pending, fallback, caution |
| Warning soft | `--warn-soft` | `rgba(176, 124, 16, 0.12)` | `rgba(176, 124, 16, 0.12)` | Warning chips and rows |
| Danger | `--bad` | `#cf4e63` | `#cf4e63` | Errors, rejection |
| Danger soft | `--bad-soft` | `rgba(207, 78, 99, 0.12)` | `rgba(207, 78, 99, 0.12)` | Danger chips and borders |
| On accent | `--on-accent` | `#fffdf9` | `#0b0d12` | Text on accent buttons |

Rules: use teal as the only primary accent. Do not introduce purple gradients, glow backgrounds, pure black text, or beige/brass luxury treatments beyond the existing warm paper palette.

## 3. Typography

| Role | Token | Value |
|---|---|---|
| Tool UI | `body` | 13.5px / 1.5, Pretendard, Apple SD Gothic Neo, Noto Sans KR, system sans |
| Mono | `--mono` | ui-monospace, SFMono-Regular, Menlo, monospace |
| Manuscript reading | `--serif` | Noto Serif KR, KoPub Batang, ui-serif, Georgia, serif |
| Page title | `h1` | 22px, 700 to 800, line-height 1.25 |
| Section label | `.label` | 10px, 800, letter-spacing 0.07em, uppercase |
| Table body | `.grid` | 12.5px / 1.5 |
| Small metadata | `.dim` | 11.5px / 1.5 |
| Manuscript editor | editor surface | 13px mono or 14.5px serif depending on file role |

Do not add new display fonts. The app is a tool surface, so headings stay compact.

## 4. Spacing

Base unit is 4px. Use these existing scales and derive only from them:

| Token | Value | Use |
|---|---:|---|
| `--space-1` | 4px | Tight button and row gaps |
| `--space-2` | 8px | Control gaps, table padding |
| `--space-3` | 12px | Panel padding, section gaps |
| `--space-4` | 16px | Shell padding, large row gaps |
| `--space-5` | 20px | Surface gaps |
| `--space-6` | 24px | Page horizontal padding |
| `--space-7` | 28px | Wide surface horizontal padding |

Existing CSS may use literal values that map to these tokens. New CSS should prefer the variables once added to `src/app.css`.

## 5. Components

Buttons: 4px radius, border `--line`, text `--muted`, hover `--bg-2` plus `--line-strong`. Primary buttons use `--accent` and `--on-accent`, font-weight 650.

Inputs and textareas: `--bg-2`, border `--line`, 4px radius, focus ring `2px solid --accent-soft` and border `--accent`.

Chips: 3px radius, 10.5px, font-weight 700. Use `ok`, `warn`, `bad`, `info`, or `muted` semantic classes only.

Rails: `--bg-rail` or `--bg-1`, separated by `--line`. Navigation rows use hairlines and selected fill `--accent-soft`.

Tables: `border-collapse: collapse`, hairline rows, uppercase metadata headers, no nested card framing.

Editor: CodeMirror editor and plain text fallback must live as an unframed work surface inside the file/episode area, with a visible path/status toolbar and no decorative preview card.

## 6. Motion

Motion is minimal. Hover, active, and focus states may use color, filter, opacity, or transform only. Default duration is 160ms to 220ms ease-out. Reduced motion should still preserve state changes without transform.

## 7. Depth

Depth strategy is hairlines and tonal surfaces, not shadows. The app uses `--line`, `--line-strong`, `--bg-1`, `--bg-2`, and `--bg-desk` to show hierarchy. Avoid drop shadows unless a modal is introduced later and documented here first.
