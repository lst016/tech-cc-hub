type DirectorySelectionModalProps = {
  visible?: boolean;
  open?: boolean;
  onCancel?: () => void;
  onClose?: () => void;
};

export default function DirectorySelectionModal(props: DirectorySelectionModalProps) {
  if (!props.visible && !props.open) return null;
  return null;
}
