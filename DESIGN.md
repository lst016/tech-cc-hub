# Design System - tech-cc-hub

## Product Context

- **What this is:** `tech-cc-hub` is a desktop Agent collaboration workbench built with Electron, React, and a Claude-compatible Agent SDK.
- **Who it is for:** power users and builders who run local coding agents, inspect execution traces, manage workspaces, and need a calm operating surface for long-running AI work.
- **Project type:** local-first desktop productivity app, with chat, workspace management, execution observability, browser annotation, and code preview surfaces.
- **Design priority:** make complex agent behavior readable without making the app feel like a generic admin dashboard.

## Design Direction

- **Aesthetic:** warm utilitarian workbench.
- **Mood:** quiet, precise, local, technical, and slightly tactile. The product should feel like a serious desktop instrument rather than a SaaS landing page.
- **Decoration level:** intentional but restrained. Use translucent panels, soft borders, subtle shadows, and a few warm highlights. Avoid heavy gradients, saturated purple/blue decoration, and decorative icon clutter.
- **Layout:** grid-disciplined app shell with focused work zones: left workspace sidebar, center conversation, right execution/preview rail.

## Color System

The product color system has two layers:

- **Product layer:** warm gray + clay accent. This is the default for chat, settings, sidebars, cards, controls, and execution views.
- **Workbench layer:** VS Code light neutral + blue. This is allowed only inside code/file preview surfaces where users expect editor semantics.

### Product Layer Tokens

Use these tokens from `src/ui/index.css` for normal product UI.

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| App background | `bg-100` | `#F8F9FB` | main page backdrop, large empty areas |
| Surface | `surface` | `#FFFFFF` | primary cards, panels, popovers |
| Surface secondary | `surface-secondary` | `#F3F4F6` | inactive controls, subtle rows |
| Surface tertiary | `surface-tertiary` | `#E9EBF0` | code chips, embedded snippets, low emphasis fills |
| Border subtle | `black/6` or `ink-900/8` | derived | default panel borders |
| Text strongest | `ink-900` | `#16181D` | page titles, primary body |
| Text primary | `ink-800` | `#252932` | normal labels and readable content |
| Text secondary | `ink-600` | `#596272` | metadata, secondary copy |
| Text muted | `muted` | `#697384` | hints, low-emphasis labels |
| Accent | `accent` | `#D26A3D` | selected state, primary action, active indicator |
| Accent hover | `accent-hover` | `#BE5D34` | hover/pressed primary action |
| Accent subtle | `accent-subtle` | `#F9EEE9` | selected card background, soft highlight |
| Accent light | `accent-light` | `#F2C2AD` | divider highlights and warm decorative accents |

### Semantic Tokens

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Success | `success` | `#16A34A` | completed runs, healthy connection |
| Success surface | `success-light` | `#DCFCE7` | success badge backgrounds |
| Error | `error` | `#DC2626` | failed run, destructive warning |
| Error surface | `error-light` | `#FEE2E2` | error badge backgrounds |
| Info | `info` | `#2563EB` | informational status, not brand accent |
| Info surface | `info-light` | `#DBEAFE` | informational badge backgrounds |
| Warning | `warning` | `#D97706` | risky operation, degraded state |
| Warning surface | `warning-light` | `#FEF3C7` | warning badge backgrounds |

### Workbench Layer Tokens

Use this layer only for code/file preview, Monaco, Explorer, file-tree selection, and line annotations.

| Role | Hex | Usage |
|------|-----|-------|
| Workbench background | `#FFFFFF` | editor and preview background |
| Workbench sidebar | `#F3F3F3` | Explorer background |
| Workbench line | `#D8DEE4` | editor/file-tree borders |
| Workbench text | `#24292F` | file names, code toolbar text |
| Workbench muted | `#6E7781` | paths and metadata |
| Workbench blue | `#0969DA` | editor selection metadata, referenced line glyph |
| Workbench blue soft | `#DDF4FF` | selected reference badge |
| Workbench comment | `#BF3989` | code comment glyph only |
| Workbench error | `#CF222E` | preview error state |

**Rule:** Workbench blue is not the product brand color. Do not use `#0969DA`, `blue-50`, `text-primary`, or `bg-primary` for normal chat/settings/product surfaces unless the UI is inside a code editor or browser-like technical viewport.

## Color Usage Rules

- Use `accent` for the product's active/selected/primary path.
- Use `info` only for informational status, not for primary actions.
- Use `success`, `warning`, and `error` only for state. Do not use them as decoration.
- Prefer warm gray surfaces over pure blue-gray surfaces in the main product shell.
- Avoid raw hex values in components. If a new color is needed, add a semantic token first.
- Avoid purple as a default accent. Purple is allowed only when a domain-specific entity truly needs it.
- Do not mix shadcn-style `primary`, `secondary`, `muted`, and `accent` semantics with this product system. If those tokens appear, map them back to this document.

## Typography

- **Primary UI font:** `PingFang SC`, `Hiragino Sans GB`, `Noto Sans CJK SC`, `Microsoft YaHei`, `ui-sans-serif`, `system-ui`, `-apple-system`, `sans-serif`.
- **Code/data font:** `SF Mono`, `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`.
- **Tone:** compact and legible. Use font weight and spacing for hierarchy; avoid decorative display fonts in the desktop app shell.

### Type Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Micro label | `10px-11px` | 600 | badges, metadata, compact counters |
| Small label | `12px` | 500-700 | buttons, tabs, tree rows |
| Body | `13px-14px` | 400-500 | conversation text, settings copy |
| Section title | `14px-16px` | 650-750 | cards and rail sections |
| Page title | `18px-22px` | 700 | modal/page title |

## Spacing and Density

- **Base unit:** `4px`.
- **Density:** compact-comfortable. This is a desktop workbench, so information density matters, but touch targets should remain readable.
- **Spacing scale:** `2xs=2px`, `xs=4px`, `sm=8px`, `md=12px`, `lg=16px`, `xl=24px`, `2xl=32px`, `3xl=48px`.
- **Panel padding:** main cards use `16px-20px`; dense toolbars use `8px-12px`; editor/file-tree rows use `28px-35px` height.

## Shape, Borders, and Shadows

- **Radius scale:** `sm=6px`, `md=10px`, `lg=16px`, `xl=22px`, `2xl=28px`, `full=999px`.
- **Default border:** `1px` using `black/6`, `ink-900/8`, or workbench line tokens.
- **Default shadow:** soft and low. Use shadows to separate floating composer and popovers, not every card.
- **Glass panels:** allowed for the chat composer and high-level shell only. Do not apply glass to dense code/workbench views.

## Layout Rules

- **Left sidebar:** workspace navigation and session list. Warm, rounded, card-like.
- **Center:** conversation stream and composer. The composer is the main affordance and can float with stronger elevation.
- **Right rail:** execution observability first, preview/workbench second. It should feel attached to the desktop shell, not like an unrelated web page.
- **Code Preview:** may use a flatter VS Code style with square edges and neutral borders.

## Motion

- **Approach:** minimal-functional.
- **Durations:** micro `80ms`, short `160-220ms`, medium `260-360ms`.
- **Use motion for:** active run pulse, hover lift, drawer/modal entry, selection feedback.
- **Avoid:** playful bouncing everywhere, generic shimmer overuse, large animated gradients.

## Component Color Guidance

### Buttons

- Primary: `bg-accent text-white hover:bg-accent-hover`.
- Secondary: `bg-white border black/6 text-ink-700 hover:bg-surface-secondary`.
- Quiet icon button: transparent by default, `hover:bg-ink-900/5`.
- Dangerous: use `error` only when the action is destructive.

### Cards and Panels

- Main card: `bg-white/72` or `bg-white`, `border-black/6`, soft shadow.
- Selected card: `bg-accent-subtle`, `border-accent/25`.
- Running card: use `info-light` or `accent-subtle` depending on whether the emphasis is status or product selection.

### Tags and Badges

- Product selected state: clay accent.
- Runtime health: semantic status colors.
- Code reference: workbench blue for selection, workbench comment magenta for code comments only.

### Code and Preview

- Monaco/editor surfaces must stay neutral white.
- File-tree selection uses workbench blue soft, not product clay.
- Referenced lines use a subtle blue line/glyph; comments use magenta glyph only.

## Migration Rules

1. `src/ui/index.css` is the source of truth for product tokens.
2. `src/ui/App.css` must not define an independent visual language. If retained, its variables must mirror this document.
3. New product UI should use Tailwind token classes such as `bg-accent`, `text-ink-800`, `bg-surface-secondary`, and `text-muted`.
4. New workbench/code UI should define local variables named `--workbench-*` or scoped component variables. Do not leak them into the product shell.
5. Replace raw `text-primary`, `bg-primary`, `blue-*`, `slate-*`, and arbitrary hex values in product UI during normal touch-up work.
6. Raw hex is acceptable in Monaco/workbench CSS only when mapped in this document.

## QA Checklist for UI Changes

- Does the page still read as warm utilitarian workbench?
- Are primary actions clay accent, not random blue/purple?
- Are status colors used only for status?
- Does workbench blue stay inside code/browser/editor-like surfaces?
- Is the hierarchy created by spacing, type weight, and surfaces rather than many competing colors?
- If a screenshot is provided, validate the actual page visually before saying done.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-01 | Product palette standardized on warm gray + clay accent | Matches existing `index.css` and the chat-first desktop workbench direction. |
| 2026-05-01 | Code preview allowed to use VS Code light blue-gray locally | Users expect editor semantics in file trees and Monaco; keeping it scoped avoids polluting the main product palette. |
| 2026-05-01 | `DESIGN.md` becomes the source of truth | Prevents future UI work from adding unrelated color systems. |
