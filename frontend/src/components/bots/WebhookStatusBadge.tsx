import type { WebhookStatus } from "@/types";
import { cn } from "@/lib/utils";

export const WEBHOOK_STATUS: Record<
  WebhookStatus,
  { label: string; dot: string; text: string; bg: string; hint: string }
> = {
  ok: {
    label: "Работает",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    hint: "Бот подключён и получает сообщения.",
  },
  pending: {
    label: "Подключается",
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50",
    hint: "Настраиваем связь с Telegram.",
  },
  error: {
    label: "Ошибка",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    hint: "Telegram не смог подключиться к серверу.",
  },
  no_https: {
    label: "Нужен домен",
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50",
    hint: "Бот сохранён, но заработает, когда платформа будет доступна по https-домену.",
  },
  disabled: {
    label: "Выключен",
    dot: "bg-zinc-400",
    text: "text-zinc-600",
    bg: "bg-zinc-100",
    hint: "Бот не отвечает подписчикам.",
  },
};

export function WebhookStatusBadge({
  status,
  className,
}: {
  status: WebhookStatus;
  className?: string;
}) {
  const s = WEBHOOK_STATUS[status] ?? WEBHOOK_STATUS.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
