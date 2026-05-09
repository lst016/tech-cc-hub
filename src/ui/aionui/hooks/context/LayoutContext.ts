export type LayoutContextValue = {
  isMobile: boolean;
  isSidebarCollapsed?: boolean;
};

export const useLayoutContext = (): LayoutContextValue => ({
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
});
