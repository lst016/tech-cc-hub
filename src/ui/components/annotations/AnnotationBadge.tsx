import { MessageSquare } from "lucide-react";
import type { Annotation } from "../../../shared/annotation.js";

/**
 * 聊天消息段落末尾的"评论气泡 + 序号"标记。
 *
 * 参考飞书文档评论交互：
 * - 段落被评论时，行末显示一个气泡图标 + 蓝色圆形序号 badge
 * - 序号是该消息内 annotation 按 created_at 排序后的下标（从 1 开始）
 * - 点击气泡的交互由上层 (AnnotationPopover) 处理，本组件只负责渲染
 */
export function AnnotationBadge({
  annotation,
  order,
  onClick,
}: {
  annotation: Annotation;
  order: number;
  onClick?: (annotation: Annotation) => void;
}) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(annotation);
  };

  return (
    <button
      type="button"
      data-annotation-id={annotation.id}
      data-annotation-order={order}
      onClick={handleClick}
      title={annotation.body ? `查看评论：${annotation.body.slice(0, 60)}` : "查看评论"}
      aria-label={`查看第 ${order} 条评论`}
      className="relative ml-1 inline-flex h-4 w-4 shrink-0 translate-y-[2px] items-center justify-center rounded-full text-accent transition hover:bg-accent/10"
    >
      <MessageSquare className="h-3 w-3" aria-hidden="true" />
      <span className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-white">
        {order}
      </span>
    </button>
  );
}
