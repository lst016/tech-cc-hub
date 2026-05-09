type WebviewHostProps = { src?: string; className?: string };

export default function WebviewHost({ src, className }: WebviewHostProps) {
  if (!src) return null;
  return <iframe className={className ?? 'h-full w-full border-0'} src={src} title="preview" />;
}
