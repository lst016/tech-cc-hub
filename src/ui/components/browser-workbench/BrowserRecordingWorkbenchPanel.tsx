import { useMemo, useState } from "react";

type BrowserRecordingWorkbenchPanelProps = {
  recordingState: BrowserWorkbenchRecordingStatus;
  recordingPackage: BrowserWorkbenchRecordingPackage | null;
  savedRootPath: string | null;
  saveError: string | null;
  runResult: BrowserWorkbenchRecordingRunResult | null;
  runEvents: BrowserWorkbenchRecordingRunEvent[];
  runRunning: boolean;
  historyItems: BrowserWorkbenchRecordingHistoryItem[];
  selectedArtifactPath: string | null;
  artifactDraftContent: string;
  artifactDirty: boolean;
  artifactSaving: boolean;
  onSelectArtifact: (path: string) => void;
  onChangeArtifactDraft: (content: string) => void;
  onSaveArtifact: () => void;
  onRunRecording: () => void;
  onCancelRun: () => void;
  onOpenRunOutput: () => void;
  onOpenTraceViewer: () => void;
  onRefreshHistory: () => void;
  onLoadHistory: (rootPath: string) => void;
  onStartLocatorPick: (actionId: string) => void;
  onCancelLocatorPick: () => void;
  onRepairLocator: (actionId: string) => void;
  onAddAssertion: (kind: BrowserWorkbenchRecordedAction["kind"], value?: string) => void;
};

type RecordingPanelTab = "timeline" | "locator" | "files" | "run" | "suite" | "diagnostics" | "history";

const artifactKindLabel: Record<BrowserWorkbenchRecordingArtifact["kind"], string> = {
  recording: "录制包",
  environment: "环境",
  data: "数据",
  page: "Page Object",
  flow: "Flow",
  fixture: "Fixture",
  spec: "Spec",
  suite: "Suite",
  diagnostics: "诊断",
  manifest: "Manifest",
  readme: "README",
};

const actionKindLabel: Record<BrowserWorkbenchRecordedAction["kind"], string> = {
  click: "点击",
  fill: "填写",
  select: "选择",
  check: "勾选",
  uncheck: "取消勾选",
  press: "按键",
  scroll: "滚动",
  navigate: "跳转",
  assertVisible: "断言可见",
  assertText: "断言文本",
  assertUrl: "断言 URL",
  assertTitle: "断言标题",
  assertCount: "断言数量",
  assertAttribute: "断言属性",
  assertScreenshot: "断言截图",
  assertResponse: "断言响应",
};

function actionTargetLabel(action: BrowserWorkbenchRecordedAction): string {
  if (action.kind === "navigate") return action.url;
  if (action.kind === "press") return action.key ?? "键盘";
  if (action.kind === "scroll") return `x:${Math.round(action.scrollX ?? 0)} y:${Math.round(action.scrollY ?? 0)}`;
  return action.target?.name ?? action.target?.text ?? action.target?.selector ?? action.target?.tagName ?? "页面元素";
}

function actionValueLabel(action: BrowserWorkbenchRecordedAction): string | null {
  if (action.kind === "fill" || action.kind === "select") return action.value ?? "";
  return null;
}

function shortPath(path: string): string {
  return path.replace(/^\.tech-cc-hub\/browser-recordings\/[^/]+\//, "");
}

function artifactIcon(kind: BrowserWorkbenchRecordingArtifact["kind"]): string {
  if (kind === "recording" || kind === "manifest" || kind === "data") return "{}";
  if (kind === "readme") return "md";
  if (kind === "spec") return "ts";
  return "<>";
}

function runStatusLabel(result: BrowserWorkbenchRecordingRunResult | null, running: boolean): string {
  if (running) return "运行中";
  if (!result) return "未运行";
  if (result.status === "passed") return "通过";
  if (result.status === "failed") return "失败";
  if (result.status === "timed-out") return "超时";
  if (result.status === "cancelled") return "已取消";
  return "错误";
}

function runStatusClass(result: BrowserWorkbenchRecordingRunResult | null, running: boolean): string {
  if (running) return "border-blue-200 bg-blue-50 text-blue-700";
  if (!result) return "border-black/8 bg-white text-ink-700";
  if (result.status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (result.status === "failed" || result.status === "timed-out") return "border-red-200 bg-red-50 text-red-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function BrowserRecordingWorkbenchPanel({
  recordingState,
  recordingPackage,
  savedRootPath,
  saveError,
  runResult,
  runEvents,
  runRunning,
  historyItems,
  selectedArtifactPath,
  artifactDraftContent,
  artifactDirty,
  artifactSaving,
  onSelectArtifact,
  onChangeArtifactDraft,
  onSaveArtifact,
  onRunRecording,
  onCancelRun,
  onOpenRunOutput,
  onOpenTraceViewer,
  onRefreshHistory,
  onLoadHistory,
  onStartLocatorPick,
  onCancelLocatorPick,
  onRepairLocator,
  onAddAssertion,
}: BrowserRecordingWorkbenchPanelProps) {
  const [activeTab, setActiveTab] = useState<RecordingPanelTab>("timeline");
  const actions = recordingPackage?.recording.actions ?? [];
  const artifacts = recordingPackage?.artifacts ?? [];
  const unstableLocators = recordingPackage?.recording.locatorCandidates.filter((candidate) => candidate.stable === false) ?? [];
  const selectedArtifact = useMemo(() => {
    if (!artifacts.length) return null;
    return artifacts.find((artifact) => artifact.path === selectedArtifactPath) ??
      artifacts.find((artifact) => artifact.kind === "spec") ??
      artifacts[0];
  }, [artifacts, selectedArtifactPath]);
  const visibleActionCount = recordingPackage?.recording.actions.length ?? recordingState.actionCount;
  const statusLabel = recordingState.recording ? "录制中" : recordingPackage ? "已生成" : "待录制";

  return (
    <aside className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-black/8 bg-[#f7f8fa]">
      <div className="border-b border-black/8 bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-ink-900">自动化录制工作台</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{statusLabel} · {visibleActionCount} 步</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {recordingPackage && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("run");
                  onRunRecording();
                }}
                disabled={runRunning || recordingState.recording || !savedRootPath || Boolean(saveError)}
                className="inline-flex h-7 items-center rounded-md border border-black/8 bg-ink-900 px-2 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
              >
                {runRunning ? "运行中" : "运行"}
              </button>
            )}
            <span className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold ${recordingState.recording ? "border-red-200 bg-red-50 text-red-600" : "border-black/8 bg-white text-ink-700"}`}>
              {recordingState.recording ? "REC" : "PKG"}
            </span>
          </div>
        </div>
        {recordingState.recording && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onAddAssertion("assertUrl")}
              className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
            >
              URL 断言
            </button>
            <button
              type="button"
              onClick={() => onAddAssertion("assertTitle")}
              className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
            >
              标题断言
            </button>
            <button
              type="button"
              onClick={() => onAddAssertion("assertScreenshot", window.prompt("截图名称", "recorded-state") ?? undefined)}
              className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
            >
              截图断言
            </button>
            <button
              type="button"
              onClick={() => onAddAssertion("assertResponse", window.prompt("响应 URL 片段", "/api/") ?? undefined)}
              className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
            >
              响应断言
            </button>
          </div>
        )}
        <div className="mt-3 flex gap-1 overflow-x-auto rounded-lg border border-black/8 bg-[#f1f3f6] p-0.5">
          {([
            ["timeline", "时间线"],
            ["locator", "Locator"],
            ["files", "文件"],
            ["run", "运行"],
            ["suite", "套件"],
            ["diagnostics", "诊断"],
            ["history", "历史"],
          ] as Array<[RecordingPanelTab, string]>).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-7 shrink-0 rounded-md px-2 text-[11px] font-medium transition ${activeTab === tab ? "bg-white text-ink-900 shadow-sm" : "text-muted hover:text-ink-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "timeline" && (
          <div className="space-y-2">
            {recordingState.recording && !actions.length && (
              <div className="rounded-lg border border-dashed border-red-200 bg-white px-3 py-4 text-sm text-muted">
                正在捕获页面操作，完成后这里会展示可编辑步骤。
              </div>
            )}
            {!recordingState.recording && !actions.length && (
              <div className="rounded-lg border border-dashed border-black/12 bg-white px-3 py-4 text-sm text-muted">
                停止录制后会生成步骤时间线、Locator 评审和文件预览。
              </div>
            )}
            {actions.map((action, index) => {
              const value = actionValueLabel(action);
              return (
                <div key={action.id} className="rounded-lg border border-black/8 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink-900 text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-ink-900">{actionKindLabel[action.kind]}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00a63e]" />
                      </div>
                      <div className="mt-1 break-words text-[12px] leading-5 text-ink-700">{actionTargetLabel(action)}</div>
                      {value !== null && <div className="mt-1 truncate rounded-md bg-[#f1f3f6] px-2 py-1 text-[11px] text-muted">{value}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "locator" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">Selector 质量</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[#edf7f1] px-2 py-2">
                  <div className="text-[18px] font-semibold text-[#007a3d]">{(recordingPackage?.recording.locatorCandidates.length ?? 0) - unstableLocators.length}</div>
                  <div className="text-[11px] text-muted">稳定候选</div>
                </div>
                <div className="rounded-md bg-[#fff5e5] px-2 py-2">
                  <div className="text-[18px] font-semibold text-[#a65f00]">{unstableLocators.length}</div>
                  <div className="text-[11px] text-muted">需评审</div>
                </div>
              </div>
            </div>
            {unstableLocators.length ? unstableLocators.slice(0, 8).map((candidate) => (
              <div key={`${candidate.actionId}-${candidate.strategy}-${candidate.value}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="text-[12px] font-semibold text-[#8a5300]">Selector 不稳定</div>
                <div className="mt-1 break-words text-[12px] leading-5 text-ink-700">{candidate.strategy}: {candidate.value}</div>
                <div className="mt-1 text-[11px] text-muted">{candidate.reason ?? "建议补 data-testid 后再固化测试。"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recordingState.locatorPickActionId === candidate.actionId ? (
                    <button
                      type="button"
                      onClick={onCancelLocatorPick}
                      className="inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      取消点选
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStartLocatorPick(candidate.actionId)}
                      className="inline-flex h-7 items-center rounded-md border border-black/8 bg-ink-900 px-2 text-[11px] font-semibold text-white transition hover:bg-black"
                    >
                      点选修复
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRepairLocator(candidate.actionId)}
                    className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
                  >
                    手输 selector
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-black/8 bg-white px-3 py-4 text-sm text-muted">
                暂无不稳定 selector。
              </div>
            )}
          </div>
        )}

        {activeTab === "files" && (
          <div className="grid min-h-[560px] grid-rows-[220px_minmax(0,1fr)] gap-3">
            <div className="min-h-0 overflow-y-auto rounded-lg border border-black/8 bg-white">
              {artifacts.length ? artifacts.map((artifact) => {
                const selected = selectedArtifact?.path === artifact.path;
                return (
                  <button
                    key={artifact.path}
                    type="button"
                    onClick={() => onSelectArtifact(artifact.path)}
                    className={`grid w-full grid-cols-[30px_1fr_auto] items-center gap-2 border-b border-black/6 px-2.5 py-2 text-left last:border-b-0 ${selected ? "bg-accent-subtle" : "hover:bg-[#f7f8fa]"}`}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-black/8 bg-white text-[10px] font-semibold text-muted">{artifactIcon(artifact.kind)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-ink-800">{shortPath(artifact.path)}</span>
                      <span className="block text-[10px] text-muted">{artifactKindLabel[artifact.kind]}</span>
                    </span>
                    <span className="text-[10px] text-muted">{artifact.language ?? ""}</span>
                  </button>
                );
              }) : (
                <div className="px-3 py-4 text-sm text-muted">暂无生成文件。</div>
              )}
            </div>
            <div className="min-h-0 overflow-hidden rounded-lg border border-black/8 bg-[#0f172a]">
              <div className="flex h-8 items-center justify-between border-b border-white/10 px-3 text-[11px] text-slate-300">
                <span className="truncate">{selectedArtifact ? shortPath(selectedArtifact.path) : "未选择文件"}</span>
                <div className="flex items-center gap-2">
                  {artifactDirty && <span className="text-amber-300">未保存</span>}
                  <span>{selectedArtifact?.language ?? ""}</span>
                  <button
                    type="button"
                    onClick={onSaveArtifact}
                    disabled={!selectedArtifact || !artifactDirty || artifactSaving}
                    className="inline-flex h-6 items-center rounded-md border border-white/15 bg-white/10 px-2 text-[10px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {artifactSaving ? "保存中" : "保存"}
                  </button>
                </div>
              </div>
              <textarea
                value={selectedArtifact ? artifactDraftContent : "停止录制后会在这里展示生成文件。"}
                onChange={(event) => onChangeArtifactDraft(event.target.value)}
                readOnly={!selectedArtifact}
                spellCheck={false}
                className="h-[calc(100%-2rem)] w-full resize-none overflow-auto bg-[#0f172a] p-3 font-mono text-[11px] leading-5 text-slate-100 outline-none placeholder:text-slate-500 read-only:text-slate-400"
              />
            </div>
          </div>
        )}

        {activeTab === "run" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">生成结果</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[#eef4ff] px-2 py-2">
                  <div className="text-[18px] font-semibold text-accent">{artifacts.length}</div>
                  <div className="text-[11px] text-muted">资产文件</div>
                </div>
                <div className="rounded-md bg-[#f1f3f6] px-2 py-2">
                  <div className="text-[18px] font-semibold text-ink-800">{visibleActionCount}</div>
                  <div className="text-[11px] text-muted">录制步骤</div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">运行器</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold ${runStatusClass(runResult, runRunning)}`}>
                  {runStatusLabel(runResult, runRunning)}
                </span>
                <button
                  type="button"
                  onClick={runRunning ? onCancelRun : onRunRecording}
                  disabled={recordingState.recording || !savedRootPath || Boolean(saveError)}
                  className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {runRunning ? "取消运行" : "运行测试"}
                </button>
                <button
                  type="button"
                  onClick={onOpenRunOutput}
                  disabled={!runResult?.outputDir}
                  className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  打开输出
                </button>
                <button
                  type="button"
                  onClick={onOpenTraceViewer}
                  disabled={!runResult?.attachments.traceFiles.length}
                  className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Trace
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-1 text-[11px] font-medium text-muted">trace {runResult?.attachments.traceFiles.length ?? 0}</span>
                <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-1 text-[11px] font-medium text-muted">screenshot {runResult?.attachments.screenshotFiles.length ?? 0}</span>
                <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-1 text-[11px] font-medium text-muted">video {runResult?.attachments.videoFiles.length ?? 0}</span>
                <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-1 text-[11px] font-medium text-muted">events {runEvents.length}</span>
              </div>
              {runResult ? (
                <div className="mt-3 space-y-2 text-[12px] leading-5 text-muted">
                  <div>耗时：{runResult.durationMs}ms · exit：{runResult.exitCode ?? "-"} {runResult.signal ? `· ${runResult.signal}` : ""}</div>
                  <div className="break-all">Spec：{runResult.specPath}</div>
                  <div className="break-all">输出：{runResult.outputDir}</div>
                  {runResult.error && <div className="text-red-600">{runResult.error}</div>}
                </div>
              ) : (
                <div className="mt-2 text-[12px] leading-5 text-muted">录制包保存后可以直接运行生成的 Playwright spec。</div>
              )}
            </div>
            {runResult && (
              <div className="overflow-hidden rounded-lg border border-black/8 bg-[#0f172a]">
                <div className="flex h-8 items-center justify-between border-b border-white/10 px-3 text-[11px] text-slate-300">
                  <span>Playwright 输出</span>
                  <span>{runResult.status}</span>
                </div>
                <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words p-3 text-[11px] leading-5 text-slate-100">
                  {[runResult.stdout, runResult.stderr].filter(Boolean).join("\n\n") || "无输出"}
                </pre>
              </div>
            )}
            {runEvents.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-black/8 bg-white">
                <div className="flex h-8 items-center justify-between border-b border-black/8 px-3 text-[11px] text-muted">
                  <span>实时日志</span>
                  <span>{runEvents.length}</span>
                </div>
                <div className="max-h-[220px] overflow-auto p-2">
                  {runEvents.slice(-80).map((event) => (
                    <div key={event.id} className="grid grid-cols-[68px_1fr] gap-2 border-b border-black/6 py-1.5 text-[11px] last:border-b-0">
                      <span className="font-semibold text-ink-700">{event.type}</span>
                      <span className="min-w-0 whitespace-pre-wrap break-words text-muted">{event.message ?? event.status ?? ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(savedRootPath || saveError) && (
              <div className={`rounded-lg border px-3 py-3 ${saveError ? "border-red-200 bg-white" : "border-black/8 bg-white"}`}>
                <div className={`text-[12px] font-semibold ${saveError ? "text-red-600" : "text-ink-900"}`}>
                  {saveError ? "保存失败" : "保存位置"}
                </div>
                <div className="mt-2 break-all text-[12px] leading-5 text-muted">{saveError ?? savedRootPath}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "suite" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">测试套件</div>
              <div className="mt-2 space-y-1 text-[12px] leading-5 text-muted">
                <div>名称：{recordingPackage?.suite.name ?? "-"}</div>
                <div>项目：{recordingPackage?.suite.projects.join(", ") ?? "-"}</div>
                <div>重试：{recordingPackage?.suite.retries ?? 0} · workers：{recordingPackage?.suite.workers ?? 1}</div>
                <div>标签：{recordingPackage?.suite.tags.join(", ") ?? "-"}</div>
              </div>
            </div>
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">运行环境</div>
              <div className="mt-2 space-y-1 text-[12px] leading-5 text-muted">
                <div className="break-all">baseURL：{recordingPackage?.environment.baseURL ?? "-"}</div>
                <div className="break-all">startPath：{recordingPackage?.environment.startPath ?? "-"}</div>
                <div>浏览器：{recordingPackage?.environment.browserName ?? "-"} · headless：{String(recordingPackage?.environment.headless ?? true)}</div>
                <div>viewport：{recordingPackage?.environment.viewport ? `${recordingPackage.environment.viewport.width} x ${recordingPackage.environment.viewport.height}` : "-"}</div>
                <div>trace：{recordingPackage?.environment.trace ?? "-"} · video：{recordingPackage?.environment.video ?? "-"}</div>
              </div>
            </div>
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">数据场景</div>
              <div className="mt-2 space-y-2">
                {(recordingPackage?.dataScenarios ?? []).map((scenario) => (
                  <div key={scenario.name} className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-2">
                    <div className="text-[12px] font-semibold text-ink-800">{scenario.name}</div>
                    <div className="mt-1 text-[11px] text-muted">{Object.keys(scenario.data).length} 个数据字段</div>
                  </div>
                ))}
                {!recordingPackage?.dataScenarios.length && <div className="text-sm text-muted">暂无数据场景。</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/8 bg-white px-3 py-3">
              <div className="text-[12px] font-semibold text-ink-900">稳定性诊断</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-[#eef4ff] px-2 py-2">
                  <div className="text-[18px] font-semibold text-accent">{recordingPackage?.diagnostics.length ?? 0}</div>
                  <div className="text-[11px] text-muted">总数</div>
                </div>
                <div className="rounded-md bg-[#fff5e5] px-2 py-2">
                  <div className="text-[18px] font-semibold text-[#a65f00]">{recordingPackage?.diagnostics.filter((item) => item.severity === "warning").length ?? 0}</div>
                  <div className="text-[11px] text-muted">警告</div>
                </div>
                <div className="rounded-md bg-[#fff0f0] px-2 py-2">
                  <div className="text-[18px] font-semibold text-red-600">{recordingPackage?.diagnostics.filter((item) => item.severity === "error").length ?? 0}</div>
                  <div className="text-[11px] text-muted">错误</div>
                </div>
              </div>
            </div>
            {(recordingPackage?.diagnostics ?? []).map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-lg border border-black/8 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold text-ink-900">{diagnostic.type}</div>
                  <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-semibold text-muted">{diagnostic.severity}</span>
                </div>
                <div className="mt-1 text-[12px] leading-5 text-ink-700">{diagnostic.message}</div>
                {diagnostic.suggestion && <div className="mt-1 text-[11px] leading-5 text-muted">{diagnostic.suggestion}</div>}
              </div>
            ))}
            {!recordingPackage?.diagnostics.length && (
              <div className="rounded-lg border border-dashed border-black/12 bg-white px-3 py-4 text-sm text-muted">
                暂无诊断结果。
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-black/8 bg-white px-3 py-3">
              <div>
                <div className="text-[12px] font-semibold text-ink-900">历史录制</div>
                <div className="mt-0.5 text-[11px] text-muted">{historyItems.length} 个录制包</div>
              </div>
              <button
                type="button"
                onClick={onRefreshHistory}
                className="inline-flex h-7 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
              >
                刷新
              </button>
            </div>
            {historyItems.length ? historyItems.map((item) => (
              <div key={item.rootPath} className="rounded-lg border border-black/8 bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-ink-900">{item.sourceUrl ?? item.id}</div>
                    {item.suiteName && <div className="mt-0.5 truncate text-[11px] text-muted">{item.suiteName}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("files");
                      onLoadHistory(item.rootPath);
                    }}
                    className="inline-flex h-7 shrink-0 items-center rounded-md border border-black/8 bg-white px-2 text-[11px] font-semibold text-ink-800 transition hover:bg-[#f7f8fa]"
                  >
                    加载
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-muted">{item.actionCount ?? 0} 步 · {item.generatedAt ? new Date(item.generatedAt).toLocaleString() : "未记录时间"}</div>
                {item.tags?.length ? <div className="mt-1 text-[11px] text-muted">{item.tags.join(", ")}</div> : null}
                <div className="mt-1 break-all text-[11px] leading-5 text-muted">{item.rootPath}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-black/12 bg-white px-3 py-4 text-sm text-muted">
                暂无历史录制。
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
