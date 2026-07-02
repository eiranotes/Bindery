# Bindery Design System

## 1. Atmosphere / Signature

Bindery should feel like a quiet desktop writing room with a visible book-building map. The interface favors dense, predictable work surfaces over marketing composition. Pensiv informs the canvas, graph, task, version, and AI-review adjacency. Muvel informs episode/wiki/memo organization, local-first/offline confidence, customizable writing environment, widgets, smart quote behavior, and platform-like manuscript preview.

Design dials:

- `DESIGN_VARIANCE`: 4
- `MOTION_INTENSITY`: 2
- `VISUAL_DENSITY`: 8

## 2. Color

Light theme:

| Token | CSS variable | Role |
|---|---|---|
| `#F4F2EE` | `--bg` | warm paper app background |
| `#FBFAF8` | `--bg-1` | primary panel |
| `#FFFFFF` | `--bg-2` | raised control surface |
| `#FDFCFA` | `--bg-desk` | manuscript page |
| `#2F2B26` | `--text` | main text |
| `#6F6A61` | `--muted` | secondary text |
| `#A09A8E` | `--faint` | tertiary labels |
| `rgba(72, 66, 56, 0.13)` | `--line` | hairline border |
| `rgba(72, 66, 56, 0.24)` | `--line-strong` | active border |
| `#315E63` | `--accent` | next target primary accent |
| `#8B6F3D` | `--accent-2` | secondary ink/warm accent |
| `#1F9D6B` | `--ok` | pass state |
| `#B07C10` | `--warn` | warning state |
| `#CF4E63` | `--bad` | destructive/error state |

Dark theme:

| Token | CSS variable | Role |
|---|---|---|
| `#0B0D12` | `--bg` | dark app background |
| `#10131C` | `--bg-1` | primary panel |
| `#161A26` | `--bg-2` | raised control surface |
| `#12141B` | `--bg-desk` | manuscript page |
| `#E7ECF5` | `--text` | main text |
| `#94A3B8` | `--muted` | secondary text |
| `#5C687C` | `--faint` | tertiary labels |
| `rgba(148, 163, 184, 0.14)` | `--line` | hairline border |
| `rgba(148, 163, 184, 0.28)` | `--line-strong` | active border |
| `#7FA3A8` | `--accent` | muted teal accent |
| `#D8B46A` | `--accent-2` | warm focus accent |

Contrast rule: text on `--bg`, `--bg-1`, `--bg-2`, and `--bg-desk` must stay at least WCAG AA for normal text. The next UI pass should replace the current purple `--accent` and blue-purple logo gradient with the teal/warm pair above.

## 3. Typography

Interface stack: `Pretendard Variable`, `Pretendard`, `-apple-system`, `Apple SD Gothic Neo`, `Noto Sans KR`, `system-ui`, `sans-serif`.

Manuscript stack: `Noto Serif KR`, `KoPub Batang`, `RIDIBatang`, `ui-serif`, `Georgia`, `serif`.

| Role | Size | Weight | Line height | Notes |
|---|---:|---:|---:|---|
| App body | 13.5px | 400 | 1.45 | compact desktop tool text |
| Panel label | 10px | 700 | 1.2 | uppercase only for structural labels |
| Panel title | 20px | 700 | 1.15 | no hero scale inside panels |
| Studio heading | 32px | 760 | 1.08 | only for current phase title |
| Manuscript body | 16px | 400 | 2.0 | user adjustable 13px to 22px |
| Mono evidence | 12px | 400 | 1.5 | agent paths, logs, hashes |

## 4. Spacing

Base unit: 4px.

| Token | Value | Use |
|---|---:|---|
| `--space-1` | 4px | tight icon gap |
| `--space-2` | 8px | control gap |
| `--space-3` | 12px | panel padding |
| `--space-4` | 16px | section padding |
| `--space-5` | 20px | studio page padding |
| `--space-6` | 24px | manuscript gutters |
| `--space-8` | 32px | editor page margin |
| `--space-12` | 48px | landing band rhythm |

## 5. Components

- App shell: fixed top bar, left book navigator, central writing/editor surface. AI work is a separate screen, not a permanent right rail on the main writing view.
- Build ladder: horizontal step strip with visible status, scrollable on narrow widths, no clipped labels without tooltip/title fallback.
- Book navigator: tabs for Book, Files, Bible; progress meter; episode rows; local/offline state.
- Manuscript editor: page-like center, serif body, split/source/preview modes, typewriter and focus modes.
- AI pipeline: proposal first, apply later. Candidate comparisons, QA, evidence, and snapshots are first-class and live outside the main writing screen.
- Widgets: Muvel-inspired optional tiles for word count, timer, dictionary, episode reference, and version history.

State recipes:

- Hover: tonal background only, no layout shift.
- Active: accent-soft background plus border.
- Focus: 2px focus ring using `--accent-2`.
- Disabled: opacity 0.4 and no pointer interaction.
- Empty: visible next action, not blank panels.
- Error: concise message with recovery action.

## 6. Motion

Motion is restrained and functional:

- Duration: 130ms to 220ms.
- Properties: transform, opacity, filter only.
- Build ladder and dock tab changes may fade/translate 4px.
- Reduced motion disables transforms and transitions.

## 7. Depth

Depth uses borders and tonal surfaces first. Shadows are limited to two levels:

- `--shadow`: subtle panel separation.
- `--shadow-pop`: modal, toast, or landing focus only.

Next UI pass should reduce landing-card shadow weight and avoid card-inside-card density on the build pages.

## Anti-Slop Locks

- No purple-to-blue default gradient as the product signature.
- No oversized landing hero as the primary app experience.
- No rounded card nesting where a table, rail, or full-width panel is the clearer tool surface.
- No visible em dash characters in app copy.
- No emoji icons in persistent controls. Replace theme icons with icon components.
- Every new UI color, spacing, radius, shadow, and font value must be added here first.
