import type { FileMentionOption } from "./file-mention-options";
import type { LarkMentionOption } from "./lark-mention-options";
import type { SlashCommandOption } from "./usePromptActions";

type SlashCommandPaletteProps = {
  surfaceWidthClass: string;
  filteredCommands: SlashCommandOption[];
  activeIndex: number;
  onSelect: (command: SlashCommandOption) => void;
};

export function SlashCommandPalette({
  surfaceWidthClass,
  filteredCommands,
  activeIndex,
  onSelect,
}: SlashCommandPaletteProps) {
  return (
    <div className={`prompt-composer-surface relative z-[130] mx-auto mb-3 ${surfaceWidthClass}`}>
      <div className="overflow-hidden rounded-[24px] border border-black/6 bg-white/94 shadow-[0_18px_50px_rgba(30,38,52,0.08)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
          <span>可用 Slash 命令</span>
          <span>{filteredCommands.length} 个</span>
        </div>
        <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto overflow-x-hidden p-2">
          {filteredCommands.map((command, index) => (
            <button
              key={command.name}
              type="button"
              className={`min-w-0 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === activeIndex ? "bg-accent/10 text-accent" : "text-ink-700 hover:bg-surface-secondary"}`}
              onClick={() => onSelect(command)}
            >
              <span className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg border border-black/8 bg-white">
                  {command.icon ? (
                    <img
                      src={command.icon}
                      alt=""
                      className="h-5 w-5 object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-muted" aria-hidden="true">/</span>
                  )}
                </span>
                <span className="shrink-0 font-medium">/{command.name}</span>
                <span className="min-w-0 truncate text-xs font-normal text-muted" title={command.description || "Enter/Tab 选择"}>
                  {command.description || "Enter/Tab 选择"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type FileMentionPaletteProps = {
  surfaceWidthClass: string;
  loading: boolean;
  fileMentionOptions: FileMentionOption[];
  activeIndex: number;
  onRefresh: () => void;
  onSelect: (option: FileMentionOption) => void;
};

type LarkMentionPaletteProps = {
  surfaceWidthClass: string;
  loading: boolean;
  options: LarkMentionOption[];
  activeIndex: number;
  onSelect: (option: LarkMentionOption) => void;
};

export function LarkMentionPalette({
  surfaceWidthClass,
  loading,
  options,
  activeIndex,
  onSelect,
}: LarkMentionPaletteProps) {
  return (
    <div className={`prompt-composer-surface mx-auto mb-3 ${surfaceWidthClass}`}>
      <div className="overflow-hidden rounded-[22px] border border-[#d0d7de] bg-white/96 shadow-[0_18px_50px_rgba(30,38,52,0.10)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
          <span>@ 飞书联系人</span>
          <span>{loading ? "正在搜索..." : `${options.length} 个候选`}</span>
        </div>
        <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto p-2">
          {options.map((option, index) => (
            <button
              key={option.openId}
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === activeIndex ? "bg-[#ddf4ff] text-[#0969da]" : "text-ink-700 hover:bg-surface-secondary"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              {option.department && (
                <span className="max-w-48 shrink truncate text-xs text-muted" title={option.department}>
                  {option.department}
                </span>
              )}
            </button>
          ))}
          {!loading && options.length === 0 && (
            <div className="px-4 py-5 text-center text-sm text-muted">
              没找到匹配的飞书联系人。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FileMentionPalette({
  surfaceWidthClass,
  loading,
  fileMentionOptions,
  activeIndex,
  onRefresh,
  onSelect,
}: FileMentionPaletteProps) {
  return (
    <div className={`prompt-composer-surface mx-auto mb-3 ${surfaceWidthClass}`}>
      <div className="overflow-hidden rounded-[22px] border border-[#d0d7de] bg-white/96 shadow-[0_18px_50px_rgba(30,38,52,0.10)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
          <span>@ 文件提及</span>
          <div className="flex items-center gap-2">
            <span>{loading ? "扫描工作区..." : `${fileMentionOptions.length} 个候选`}</span>
            <button
              type="button"
              className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:text-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onRefresh}
            >
              刷新
            </button>
          </div>
        </div>
        <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto p-2">
          {fileMentionOptions.map((option, index) => (
            <button
              key={option.path}
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === activeIndex ? "bg-[#ddf4ff] text-[#0969da]" : "text-ink-700 hover:bg-surface-secondary"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[12px] ${option.kind === "directory" ? "border-[#d0d7de] bg-[#f6f8fa] text-[#57606a]" : "border-[#bfd7ff] bg-[#ddf4ff] text-[#0969da]"}`}>
                {option.kind === "directory" ? "⌁" : "□"}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
              <span className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] text-muted">
                {option.kind === "directory" ? "目录" : "文件"}
              </span>
            </button>
          ))}
          {!loading && fileMentionOptions.length === 0 && (
            <div className="px-4 py-5 text-center text-sm text-muted">
              没找到匹配文件，试试缩短关键词。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
