# Cowart-style annotations for the image canvas

## Goal

Bring Cowart's image annotation workflow into the existing `codex-canvas` plugin
without replacing the current vanilla JavaScript canvas with tldraw/React.

## User flow

1. Select an image and choose **标注**.
2. Drag to draw a persistent red arrow.  Releasing a meaningful arrow opens its
   label editor immediately; a short drag is discarded.
3. Add and edit text labels.  Arrows and labels are tied to their source image
   so selecting that image restores the whole annotation set.
4. Choose **按标注修改**.  The plugin rasterises only the source image and its
   related annotations into a local PNG, then sends that PNG plus a precise
   instruction to the bound Tech CC Hub conversation.
5. The existing conversation-to-canvas image sync collects the generated result
   back into the same project canvas.  Original image and annotations remain.

## Cowart semantics retained

- arrow creation has `idle -> pointing -> label editing` behaviour;
- default colour is red, end arrowhead is present, and short drags are ignored;
- each annotation is persistent and belongs to a source image;
- related arrows/text are discovered by source-image relation rather than
  viewport coincidence;
- the edit request contains a rendered image-plus-annotations reference, not a
  segmentation mask or a generic Hub image job;
- the request continues the bound left conversation, which retains normal
  image-generation tools and returns results through the established bridge.

## Adaptation boundary

Cowart is a React/tldraw app.  Copying its components verbatim would introduce
a new rendering/state engine and rewrite the current plugin.  This port copies
the visible interaction/data-flow contract into the existing object store,
DOM renderer, history, and Hub bridge.  No dependency is added.

## Data model

`annotation-arrow` objects use canvas coordinates with start/end points,
`sourceImageId`, `color`, and `labelObjectId`.  Annotation labels are text
objects with `sourceImageId`, `annotationArrowId`, and `isAnnotationLabel`.
The source image id is the authoritative relationship; the label id makes
selection/deletion deterministic.

## Safety and recovery

- Image and annotations are never destructively altered by a request.
- Reference PNGs stay inside the active canvas project's assets directory.
- A missing bound conversation returns a clear error and does not create a
  half-finished image job.
- Existing pencil/text and quick-edit behaviour remain unchanged.
