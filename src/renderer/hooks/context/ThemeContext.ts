export type ThemeContextValue = {
  theme: 'light' | 'dark';
  isDark: boolean;
};

export const useThemeContext = (): ThemeContextValue => ({ theme: 'light', isDark: false });
