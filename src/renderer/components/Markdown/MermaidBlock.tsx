type MermaidBlockProps = { code?: string; children?: string };

export default function MermaidBlock({ code, children }: MermaidBlockProps) {
  return <pre className="overflow-auto rounded-lg bg-black/5 p-3 text-xs">{code ?? children}</pre>;
}
