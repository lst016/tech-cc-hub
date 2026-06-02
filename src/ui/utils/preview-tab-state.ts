export type PreviewTabDirtyState = {
  path: string;
  fileName: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
};

export function isPreviewTabDirty(tab: Pick<PreviewTabDirtyState, "content" | "savedContent" | "isDirty">): boolean {
  return tab.isDirty || tab.content !== tab.savedContent;
}

export function markPreviewTabContent<T extends Pick<PreviewTabDirtyState, "content" | "savedContent" | "isDirty">>(
  tab: T,
  content: string,
): T {
  return {
    ...tab,
    content,
    isDirty: content !== tab.savedContent,
  };
}

export function listDirtyPreviewTabs<T extends Pick<PreviewTabDirtyState, "content" | "savedContent" | "isDirty">>(
  tabs: readonly T[],
): T[] {
  return tabs.filter((tab) => isPreviewTabDirty(tab));
}

export function buildPreviewUnsavedCloseMessage<T extends Pick<PreviewTabDirtyState, "fileName">>(
  dirtyTabs: readonly T[],
): string {
  if (dirtyTabs.length <= 0) {
    return "";
  }
  if (dirtyTabs.length === 1) {
    return `标签页 ${dirtyTabs[0]!.fileName} 有未保存修改，确认关闭吗？`;
  }
  return `即将关闭 ${dirtyTabs.length} 个标签页，存在未保存修改，确认继续吗？`;
}

export function confirmClosePreviewTabs<T extends Pick<PreviewTabDirtyState, "content" | "savedContent" | "isDirty" | "fileName">>(
  tabsToClose: readonly T[],
  confirmFn: (message: string) => boolean,
): boolean {
  const dirtyTabs = listDirtyPreviewTabs(tabsToClose);
  if (dirtyTabs.length === 0) {
    return true;
  }
  return confirmFn(buildPreviewUnsavedCloseMessage(dirtyTabs));
}
