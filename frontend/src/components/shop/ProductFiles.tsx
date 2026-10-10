"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { productsApi } from "@/api/shop";
import { apiErrorMessage } from "@/lib/errors";
import { cn, formatBytes } from "@/lib/utils";
import type { ProductDetail } from "@/types";

const MAX_SIZE = 50 * 1024 * 1024;

interface UploadItem {
  name: string;
  progress: number;
}

export function ProductFiles({ product }: { product: ProductDetail }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product", product.id] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const remove = useMutation({
    mutationFn: (fileId: string) => productsApi.removeFile(product.id, fileId),
    onSuccess: refresh,
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось удалить файл")),
  });

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        toast.error(`«${file.name}» больше 50 МБ — Telegram не позволит боту отправить такой файл`);
        continue;
      }
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        await productsApi.uploadFile(product.id, file, (progress) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress } : x))),
        );
        refresh();
      } catch (err) {
        toast.error(apiErrorMessage(err, `Не удалось загрузить «${file.name}»`));
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          drag
            ? "border-[#069DDF] bg-[rgba(6,157,223,0.06)]"
            : "border-black/[0.1] hover:border-[rgba(6,157,223,0.5)] hover:bg-black/[0.015]",
        )}
      >
        <UploadCloud className="h-7 w-7 text-[#069DDF]" strokeWidth={1.75} />
        <span className="text-sm font-medium text-[#171717]">Перетащите файлы сюда или нажмите, чтобы выбрать</span>
        <span className="text-xs text-[#8e8e93]">PDF, видео, аудио, архивы — до 50 МБ каждый</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {(product.files.length > 0 || uploads.length > 0) && (
        <ul className="divide-y divide-black/[0.05] rounded-xl border border-black/[0.06]">
          {product.files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-[#2B2E81]" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#171717]">{f.filename}</div>
                <div className="text-xs text-[#8e8e93]">{formatBytes(f.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(f.id)}
                disabled={remove.isPending}
                className="rounded-lg p-2 text-[#8e8e93] transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Удалить ${f.filename}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.name} className="flex items-center gap-3 px-4 py-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#069DDF]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[#636366]">{u.name}</div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full bg-[#069DDF] transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {product.files.length === 0 && uploads.length === 0 && (
        <p className="text-xs text-amber-700">
          Добавьте хотя бы один файл — его бот отправит покупателю сразу после оплаты.
        </p>
      )}
    </div>
  );
}
