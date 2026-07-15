# Chat Image Attachment Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-width image attachment rows with a compact, image-first thumbnail gallery in chat messages.

**Architecture:** Keep attachment rendering in the existing `UserPromptCard` branch in `EventCard.tsx`. Change only the image branch and its parent gallery layout; preserve the non-image branch and lightbox state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 utility classes, Node test runner

---

### Task 1: Lock the gallery contract

**Files:**
- Modify: `test/electron/chat-attachment-layout.test.ts`

- [ ] **Step 1: Replace the old row assertions with gallery assertions**

Require the parent to use a two-column responsive grid and the image branch to contain an aspect-ratio thumbnail button, `object-cover`, a filename overlay, and an accessible label. Assert the old `chat-attachment-meta` row is absent.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/electron/chat-attachment-layout.test.ts`

Expected: FAIL because `EventCard.tsx` still contains the old single-line image row.

### Task 2: Implement the compact image gallery

**Files:**
- Modify: `src/ui/components/EventCard.tsx:1497`

- [ ] **Step 1: Change the attachment container and image branch**

Use a responsive two-column grid for image previews, a bounded aspect-ratio thumbnail, a bottom gradient filename overlay, and the existing lightbox click handler. Keep text attachment markup unchanged and span it across the grid.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run: `node --test test/electron/chat-attachment-layout.test.ts`

Expected: PASS.

- [ ] **Step 3: Run scoped static verification**

Run: `npx eslint src/ui/components/EventCard.tsx test/electron/chat-attachment-layout.test.ts`

Expected: no errors.

Run: `npm run build`

Expected: successful TypeScript and Vite build.

### Task 3: Visual verification

**Files:**
- Modify if required by review: `src/ui/components/EventCard.tsx`

- [ ] **Step 1: Capture the attachment UI from the development server**

Run the existing `npm run dev:react` surface and use the QA fixture or a representative message with multiple images.

- [ ] **Step 2: Run visual-verdict**

Compare the generated screenshot with the user-supplied screenshot. The intended category must match and the score must be at least 90; otherwise apply the concrete suggestions and repeat.
