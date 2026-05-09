import type { HTMLAttributes } from 'react';

export default function FlexFullContainer({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex min-h-0 min-w-0 flex-1 ${className}`} {...props} />;
}
