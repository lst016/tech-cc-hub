export const isElectronDesktop = () => typeof window !== 'undefined' && Boolean((window as any).electron);
