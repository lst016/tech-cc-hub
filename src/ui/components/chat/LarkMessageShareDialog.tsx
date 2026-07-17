import { useEffect, useRef, useState } from "react";
import { CircleX, LoaderCircle, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { AppModalOverlay } from "../AppModalOverlay";
import { withSearchTimeout } from "../../utils/lark-search";

type LarkShareRecipient = {
  kind: "user" | "chat";
  id: string;
  name: string;
  detail?: string;
  avatarUrl?: string;
};

type LarkContactOption = {
  openId: string;
  name: string;
  department?: string;
};

export type LarkMessageShareDialogProps = {
  message: string;
  onClose: () => void;
  onRequestPermissionAssist: () => void;
};

const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_TIMEOUT_MS = 6_000;

function formatLarkShareError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim() || "飞书操作失败，请检查 lark-cli 配置后重试。";
}

function RecipientAvatar({ recipient }: { recipient: LarkShareRecipient }) {
  const RecipientIcon = recipient.kind === "user" ? UserRound : UsersRound;
  return (
    <span
      className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border ${
        recipient.kind === "user"
          ? "border-slate-200 bg-slate-100 text-slate-500"
          : "border-indigo-200 bg-indigo-50 text-indigo-600"
      }`}
    >
      <RecipientIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      {recipient.avatarUrl && (
        <img
          src={recipient.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

export function LarkMessageShareDialog({ message, onClose, onRequestPermissionAssist }: LarkMessageShareDialogProps) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<LarkShareRecipient[]>([]);
  const [chats, setChats] = useState<LarkShareRecipient[]>([]);
  const [selected, setSelected] = useState<LarkShareRecipient | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const requestIdRef = useRef(0);

  const recipients = [...people, ...chats];
  const loading = peopleLoading || chatsLoading;
  const searchError = !loading && recipients.length === 0
    ? peopleError ?? chatsError
    : null;
  const canRequestPermissionAssist = Boolean(sendError?.includes("im:message.send_as_user"));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || sending) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, sending]);

  useEffect(() => {
    const normalized = query.trim();
    const requestId = ++requestIdRef.current;
    setPeople([]);
    setChats([]);
    setPeopleError(null);
    setChatsError(null);
    setSendError(null);

    if (!normalized) {
      setPeopleLoading(false);
      setChatsLoading(false);
      return;
    }

    setPeopleLoading(true);
    setChatsLoading(true);
    const timer = window.setTimeout(() => {
      void withSearchTimeout(window.electron.searchLarkContacts(normalized), "人员", SEARCH_TIMEOUT_MS)
        .then((contacts: LarkContactOption[]) => {
          if (requestIdRef.current !== requestId) return;
          setPeople(contacts.map((contact) => ({
            kind: "user",
            id: contact.openId,
            name: contact.name,
            detail: contact.department || "人员",
          })));
        })
        .catch((error) => {
          if (requestIdRef.current !== requestId) return;
          setPeopleError(formatLarkShareError(error));
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setPeopleLoading(false);
        });

      void withSearchTimeout(window.electron.searchLarkShareChats(normalized), "群聊", SEARCH_TIMEOUT_MS)
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setChats(result);
        })
        .catch((error) => {
          if (requestIdRef.current !== requestId) return;
          setChatsError(formatLarkShareError(error));
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setChatsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);
  };

  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await window.electron.sendLarkShareMessage({ recipient: selected, text: message });
      toast.success("已发送到飞书", { description: selected.name });
      onClose();
    } catch (error) {
      setSendError(formatLarkShareError(error));
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <AppModalOverlay
      aria-labelledby="lark-share-dialog-title"
      className="z-[1200] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div className="flex max-h-[min(680px,calc(100vh-32px))] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_72px_rgba(15,23,42,0.22)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="lark-share-dialog-title" className="text-[17px] font-semibold text-slate-950">发送到飞书</h2>
            <p className="mt-1 text-xs text-slate-500">选择一个人员或群聊，发送当前回复</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={sending}
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 px-5 py-4">
          <div className="relative">
            <input
              id="lark-share-recipient-search"
              autoFocus
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="输入人员或群名"
              className="h-10 w-full rounded-[8px] border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3156e8] focus:ring-1 focus:ring-[#3156e8]"
            />
            {query && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => handleQueryChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                <CircleX className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="mt-3 min-h-[330px] max-h-[410px] overflow-y-auto rounded-[10px] border border-slate-200 bg-white p-2">
            {!query.trim() ? (
              <div className="grid min-h-[312px] place-items-center text-sm text-slate-400">输入人员或群名开始搜索</div>
            ) : recipients.length === 0 && loading ? (
              <div className="grid min-h-[312px] place-items-center text-sm text-slate-500" aria-live="polite">正在搜索人员和群聊…</div>
            ) : searchError ? (
              <div className="grid min-h-[312px] place-items-center px-8 text-center text-sm leading-6 text-red-600" role="alert">{searchError}</div>
            ) : recipients.length === 0 ? (
              <div className="grid min-h-[312px] place-items-center text-sm text-slate-400">没有找到匹配的人员或群聊</div>
            ) : (
              <div className="space-y-0.5">
                {recipients.map((recipient) => {
                  const isSelected = selected?.kind === recipient.kind && selected.id === recipient.id;
                  return (
                    <label
                      key={`${recipient.kind}:${recipient.id}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-2.5 py-2 transition ${
                        isSelected ? "bg-[#f1f5ff]" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelected(isSelected ? null : recipient)}
                        className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-slate-300 accent-[#3156e8]"
                        aria-label={`选择${recipient.name}`}
                      />
                      <RecipientAvatar recipient={recipient} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium leading-5 text-slate-900">{recipient.name}</span>
                        <span className="mt-0.5 block truncate text-xs leading-4 text-slate-500">{recipient.detail || (recipient.kind === "user" ? "人员" : "群聊")}</span>
                      </span>
                    </label>
                  );
                })}
                {loading && (
                  <div className="px-3 py-2 text-center text-xs text-slate-400" aria-live="polite">正在补充更多结果…</div>
                )}
              </div>
            )}
          </div>

          {sendError && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
              <span className="min-w-0 flex-1">{sendError}</span>
              {canRequestPermissionAssist && (
                <button
                  type="button"
                  onClick={onRequestPermissionAssist}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-red-200 bg-white px-3 font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Agent 辅助申请权限
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm text-slate-700">已选择：<span className="font-semibold text-slate-950">{selected ? 1 : 0}</span> 个</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">将以当前登录的飞书账号本人身份发送</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              className="h-10 rounded-[8px] border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!selected || sending}
              onClick={() => void handleSend()}
              className="inline-flex h-10 min-w-[92px] items-center justify-center gap-2 rounded-[8px] bg-[#3156e8] px-5 text-sm font-medium text-white transition hover:bg-[#2748cf] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {sending ? "发送中" : "确认"}
            </button>
          </div>
        </footer>
      </div>
    </AppModalOverlay>,
    document.body,
  );
}
