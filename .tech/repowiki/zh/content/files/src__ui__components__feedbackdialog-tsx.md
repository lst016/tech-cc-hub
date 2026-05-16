# src/ui/components/FeedbackDialog.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：361

## 文件职责

反馈对话框组件，允许用户提交问题反馈和截图附件

## 关键符号

- `createAttachment@0 - 创建附件对象`
- `readFileAsDataUrl@0 - 异步读取文件为DataURL`
- `addAttachments@0 - 添加图片附件，支持拖放和粘贴`
- `FeedbackDialog@0 - 反馈对话框主组件`

## 依赖输入

- `react`

## 对外暴露

- `FeedbackDialog`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useState, useRef, useCallback } from "react";

interface Attachment {
  id: string;
  dataUrl: string;
  name: string;
}

let nextAttachmentId = 0;

function createAttachment(dataUrl: string, name: string): Attachment {
  return { id: `att-${nextAttachmentId++}`, dataUrl, name };
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_ATTACHMENTS = 10;

interface FeedbackDialogProps {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: FeedbackDialogProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; issueUrl?: string; error?: string; fallback?: boolean; message?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAttachments = useCallback((files: File[]) => {
    setAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) {
        alert(`最多支持 ${MAX_ATTACHMENTS} 张图片。`);
        return prev;
      }
      const candidates = files.filter((f) => f.type.startsWith("image/")).slice(0, remaining);
      if (candidates.length === 0) {
        alert("请选择图片文件。");
        return prev;
      }
      if (candidates.length < files.length) {
        alert(`已过滤非图片文件，新增 ${candidates.length} 张图片。`);
      }
      const newAttachments = candidates.map((f) => createAttachment("", f.name));
      Promise.all(
        candidates.map(async (f, i) => {
          const dataUrl = await readFileAsDataUrl(f);
          setAttachments((current) => {
            const updated = [...current];
            const idx = updated.findIndex((a) => a.id === newAttachments[i]!.id);
            if (idx !== -1) updated[idx] = { ...updated[idx]!, dataUrl };
            return updated;
          });
        }),
      );
      return [...prev, ...newAttachments];
    });
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addAttachments(Array.from(files));
      }
      e.target.value = "";
    },
    [addAttachments],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addAttachments(imageFiles);
      }
    },
    [addAttachments],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        addAttachments(Array.from(files));
      }
    },
    [addAttachments],
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed && attachments.length === 0) {
      alert("请填写反馈内容或添加图片。");
      return;
    }

    const readyAttachments = attachments.filter((a) => a.dataUrl);
    if (attachments.length > 0 && readyAttachments.length === 0) {
      alert("图片正在加载中，请稍后再
... (truncated)
```
