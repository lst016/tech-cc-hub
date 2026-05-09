import type { ReactNode } from 'react';

export type SlashCommandMenuItem = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
};
