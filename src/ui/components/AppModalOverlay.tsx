import type { ComponentPropsWithoutRef } from "react";

export type AppModalOverlayProps = ComponentPropsWithoutRef<"div">;

export function AppModalOverlay({
  className = "",
  role = "dialog",
  "aria-modal": ariaModal,
  ...props
}: AppModalOverlayProps) {
  const resolvedAriaModal = ariaModal ?? (
    role === "dialog" || role === "alertdialog" ? true : undefined
  );

  return (
    <div
      {...props}
      role={role}
      aria-modal={resolvedAriaModal}
      data-app-modal-overlay="true"
      data-browser-workbench-occluder="true"
      className={`fixed inset-0 ${className}`.trim()}
    />
  );
}
