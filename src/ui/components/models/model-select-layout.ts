export type ModelSelectMenuLayout = {
  direction: "bottom" | "top";
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

type ModelSelectTriggerRect = {
  bottom: number;
  left: number;
  top: number;
  width: number;
};

const MODEL_MENU_GAP = 8;
const MODEL_MENU_MAX_HEIGHT = 336;
const MODEL_MENU_VIEWPORT_MARGIN = 16;

export function getModelSelectMenuLayout(
  triggerRect: ModelSelectTriggerRect,
  viewportWidth: number,
  viewportHeight: number,
  preferredPlacement: "bottom" | "top",
  isComposer: boolean,
): ModelSelectMenuLayout {
  const maximumWidth = Math.max(0, viewportWidth - MODEL_MENU_VIEWPORT_MARGIN * 2);
  const preferredWidth = isComposer ? Math.max(triggerRect.width, 320) : triggerRect.width;
  const width = Math.min(preferredWidth, maximumWidth);
  const maximumLeft = Math.max(MODEL_MENU_VIEWPORT_MARGIN, viewportWidth - width - MODEL_MENU_VIEWPORT_MARGIN);
  const left = Math.min(Math.max(triggerRect.left, MODEL_MENU_VIEWPORT_MARGIN), maximumLeft);
  const availableBelow = viewportHeight - triggerRect.bottom - MODEL_MENU_GAP;
  const availableAbove = triggerRect.top - MODEL_MENU_GAP;
  const direction = preferredPlacement === "top"
    || (availableBelow < MODEL_MENU_MAX_HEIGHT && availableAbove > availableBelow)
    ? "top"
    : "bottom";

  return direction === "top"
    ? {
        direction,
        left,
        width,
        bottom: viewportHeight - triggerRect.top + MODEL_MENU_GAP,
      }
    : {
        direction,
        left,
        width,
        top: triggerRect.bottom + MODEL_MENU_GAP,
      };
}
