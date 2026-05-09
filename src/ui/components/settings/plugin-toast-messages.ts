type PluginActionToastInput = {
  success: boolean;
  message: string;
  version?: string;
  latestVersion?: string;
  error?: string;
};

export type PluginActionToastMessage = {
  kind: "success" | "error";
  title: string;
  description?: string;
};

export function buildPluginActionToastMessage(result: PluginActionToastInput): PluginActionToastMessage {
  const details = [
    result.version ? `当前版本：${result.version}` : "",
    result.latestVersion ? `最新版本：${result.latestVersion}` : "",
    result.error ? `错误详情：${result.error}` : "",
  ].filter(Boolean);

  return {
    kind: result.success ? "success" : "error",
    title: result.message,
    description: details.length > 0 ? details.join(" · ") : undefined,
  };
}
