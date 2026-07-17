import type { ReactNode } from "react";
import { ArrowUp, Maximize2, Minimize2, Paperclip, Plus, Sparkles, Square, Target, Workflow } from "lucide-react";
import type { RuntimeReasoningMode } from "../../types";
import type { ModelOption } from "../models/ModelSelect";
import { TooltipButton } from "../TooltipButton";
import { ComposerModelMenu } from "./ComposerModelMenu";

const COMPOSER_ICON_TOOLTIP_CLASS = "!top-auto bottom-full !mt-0 mb-2 whitespace-nowrap";

type PromptComposerFooterProps = {
  pluginMenu?: ReactNode;
  modelValue: string;
  modelOptions: ModelOption[];
  reasoningMode: RuntimeReasoningMode;
  modelDisabled: boolean;
  modelPlaceholder: string;
  onModelChange: (model: string) => void;
  onReasoningModeChange: (mode: RuntimeReasoningMode) => void;
  disabled: boolean;
  slashBrowserOpen: boolean;
  slashCommandDisabled: boolean;
  onToggleSlashBrowser: () => void;
  optimizingPrompt: boolean;
  onOptimizePrompt: () => void;
  onSelectAttachment: () => void;
  workflowEnabled: boolean;
  onToggleWorkflow: () => void;
  goalEnabled: boolean;
  onToggleGoal: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  hasDraft: boolean;
  isRunning: boolean;
  onPrimaryAction: () => void;
};

export function PromptComposerFooter({
  pluginMenu,
  modelValue,
  modelOptions,
  reasoningMode,
  modelDisabled,
  modelPlaceholder,
  onModelChange,
  onReasoningModeChange,
  disabled,
  slashBrowserOpen,
  slashCommandDisabled,
  onToggleSlashBrowser,
  optimizingPrompt,
  onOptimizePrompt,
  onSelectAttachment,
  workflowEnabled,
  onToggleWorkflow,
  goalEnabled,
  onToggleGoal,
  expanded,
  onToggleExpanded,
  hasDraft,
  isRunning,
  onPrimaryAction,
}: PromptComposerFooterProps) {
  const primaryActionLabel = !hasDraft && isRunning
    ? "停止会话"
    : isRunning
      ? "加入待发送队列"
      : "发送提示";

  return (
    <div className="prompt-composer-footer mt-2 flex min-h-10 items-center justify-between gap-3 overflow-visible">
      <div className="prompt-composer-runtime-controls flex min-w-max items-center gap-2 text-[#73777f]">
        {pluginMenu}
        <ComposerModelMenu
          modelValue={modelValue}
          modelOptions={modelOptions}
          reasoningMode={reasoningMode}
          disabled={modelDisabled}
          onModelChange={onModelChange}
          onReasoningModeChange={onReasoningModeChange}
          placeholder={modelPlaceholder}
        />
      </div>
      <div className="ml-auto flex min-w-max shrink-0 items-center gap-1 text-[#9ca0a7]">
        <TooltipButton
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50 ${slashBrowserOpen ? "bg-[#ecfaf7] text-[#00ad9a]" : ""}`}
          onClick={onToggleSlashBrowser}
          aria-label="打开 Slash 命令列表"
          title="Slash 命令"
          tooltip="Slash 命令"
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={slashCommandDisabled}
        >
          <Plus className="h-[19px] w-[19px]" aria-hidden="true" />
        </TooltipButton>
        <TooltipButton
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50 ${optimizingPrompt ? "bg-[#ecfaf7] text-[#00ad9a]" : ""}`}
          onClick={onOptimizePrompt}
          aria-label="优化 Prompt"
          title="优化 Prompt"
          tooltip="优化 Prompt"
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled || optimizingPrompt}
        >
          <Sparkles className={`h-[19px] w-[19px] ${optimizingPrompt ? "animate-pulse" : ""}`} aria-hidden="true" />
        </TooltipButton>
        <TooltipButton
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSelectAttachment}
          aria-label="添加附件"
          title="添加附件"
          tooltip="添加附件"
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled}
        >
          <Paperclip className="h-[19px] w-[19px]" aria-hidden="true" />
        </TooltipButton>
        <TooltipButton
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
            workflowEnabled
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-transparent text-[#73777f] hover:bg-[#f4f6f8]"
          }`}
          onClick={onToggleWorkflow}
          aria-label={workflowEnabled ? "取消本次使用 Workflow" : "本次使用 Workflow"}
          aria-pressed={workflowEnabled}
          title="本次使用 Workflow"
          tooltip="本次使用 Workflow"
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled}
        >
          <Workflow className="h-4 w-4 shrink-0" aria-hidden="true" />
        </TooltipButton>
        <TooltipButton
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
            goalEnabled
              ? "border-[#34c759] bg-[#f3fbf6] text-[#1f9d4d]"
              : "border-transparent text-[#73777f] hover:bg-[#f4f6f8]"
          }`}
          onClick={onToggleGoal}
          aria-label={goalEnabled ? "关闭追求目标模式" : "开启追求目标模式"}
          aria-pressed={goalEnabled}
          title="追求目标"
          tooltip="追求目标"
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled}
        >
          <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
        </TooltipButton>
        <TooltipButton
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
            expanded
              ? "border-accent/45 bg-[#fff4ee] text-accent"
              : "border-transparent text-[#73777f] hover:bg-[#f4f6f8]"
          }`}
          onClick={onToggleExpanded}
          aria-label={expanded ? "收起输入框" : "放大输入框"}
          aria-pressed={expanded}
          title={expanded ? "收起输入框" : "放大输入框"}
          tooltip={expanded ? "收起输入框" : "放大输入框"}
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled}
        >
          {expanded
            ? <Minimize2 className="h-[19px] w-[19px]" aria-hidden="true" />
            : <Maximize2 className="h-[19px] w-[19px]" aria-hidden="true" />}
        </TooltipButton>
        <TooltipButton
          type="button"
          className={`grid h-9 w-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${!hasDraft && isRunning ? "bg-error text-white hover:bg-error/90" : "bg-[#111111] text-white hover:bg-black"}`}
          onClick={onPrimaryAction}
          aria-label={primaryActionLabel}
          tooltip={primaryActionLabel}
          tooltipClassName={COMPOSER_ICON_TOOLTIP_CLASS}
          disabled={disabled}
        >
          {!hasDraft && isRunning ? (
            <Square className="h-4 w-4 fill-current" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-5 w-5 stroke-[2.4]" aria-hidden="true" />
          )}
        </TooltipButton>
      </div>
    </div>
  );
}
