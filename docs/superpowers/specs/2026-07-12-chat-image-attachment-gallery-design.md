# Chat Image Attachment Gallery Design

## Goal

Make image attachments in user messages feel like visual content instead of oversized file rows, while preserving the existing click-to-preview behavior.

## Design

- Render image attachments in a compact responsive gallery inside the existing 78% message width.
- Use two columns when space allows, with a bounded thumbnail height and `object-cover` so screenshots remain legible without creating tall cards.
- Put the file name in a subtle bottom overlay. Remove the redundant “图片” badge and the full-width gray row chrome.
- Keep a single image reasonably sized instead of stretching it across the entire message width.
- Preserve the existing lightbox and accessible button label. Text attachments keep their current text-preview card.

## Boundaries

- No attachment data-model, persistence, upload, or lightbox behavior changes.
- No new dependency or component extraction.
- The change is limited to `EventCard.tsx` and its focused source-layout regression test.

## Verification

- Update the focused test to require gallery layout, image-first thumbnails, filename overlay, and removal of the old row metadata.
- Run the focused test through a red-green cycle.
- Run TypeScript/build verification.
- Capture the development UI and compare it against the supplied screenshot with `visual-verdict`; iterate until the result reaches the pass threshold.
