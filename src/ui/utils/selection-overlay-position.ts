export type SelectionOverlayPositionInput = {
  editorWidth: number;
  editorHeight: number;
  editorViewportTop: number;
  selectionTop: number;
  selectionLeft: number;
  viewportHeight: number;
  composerBottomOffset: number;
};

export type SelectionOverlayPosition = {
  top: number;
  left: number;
  commentTop: number;
};

const EDGE_PADDING = 8;
const COMMENT_GAP = 8;
const ACTION_HEIGHT = 30;
const COMMENT_BOX_WIDTH = 360;
const COMMENT_BOX_HEIGHT = 172;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

export function calculateSelectionOverlayPosition(input: SelectionOverlayPositionInput): SelectionOverlayPosition {
  const visibleBottom = clamp(
    input.viewportHeight - input.composerBottomOffset - input.editorViewportTop - 12,
    96,
    input.editorHeight,
  );
  const left = clamp(
    input.selectionLeft + 18,
    12,
    input.editorWidth - COMMENT_BOX_WIDTH - 12,
  );
  const top = clamp(
    input.selectionTop + 8,
    EDGE_PADDING,
    visibleBottom - ACTION_HEIGHT - EDGE_PADDING,
  );
  const belowCommentTop = top + ACTION_HEIGHT + COMMENT_GAP;
  const canFitBelow = belowCommentTop + COMMENT_BOX_HEIGHT <= visibleBottom;
  const preferredCommentTop = canFitBelow
    ? belowCommentTop
    : top - COMMENT_BOX_HEIGHT - COMMENT_GAP;
  const commentTop = clamp(
    preferredCommentTop,
    EDGE_PADDING,
    visibleBottom - COMMENT_BOX_HEIGHT - EDGE_PADDING,
  );

  return { top, left, commentTop };
}
