import type { ReactNode } from 'react';

type CollapsibleContentProps = {
  children?: ReactNode;
  collapsed?: boolean;
  className?: string;
};

export default function CollapsibleContent({ children, collapsed, className }: CollapsibleContentProps) {
  if (collapsed) return null;
  return <div className={className}>{children}</div>;
}
