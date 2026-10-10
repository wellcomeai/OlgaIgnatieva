"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Power, RefreshCw, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { botsApi } from "@/api/bots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import type { Bot, BotWebhookInfo } from "@/types";
import { WEBHOOK_STATUS, WebhookStatusBadge } from "./WebhookStatusBadge";

export function BotSettings({ bot }: { bot: Bot }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [info, setInfo] = useState<BotWebhookInfo | null>(null);

  const onBot = (updated: Bot) => qc.setQueryData(["bot", bot.id], updated);
  const onError = (fallback: string) => (err: unknown) => toast.error(apiErrorMessage(err, fallback));

  const reconnect = useMutation({
    mutationFn: () => botsApi.refreshWebhook(bot.id),
    onSuccess: (b) => {
      onBot(b);
      if (b.webhook_status === "ok") toast.success("Бот переподключён");
      else toast.error(WEBHOOK_STATUS[b.webhook_status].hint);
    },
    onError: onError("Не удалось переподключить"),
  });

  const check = useMutation({
    mutationFn: () => botsApi.webhookInfo(bot.id),
    onSuccess: setInfo,
    onError: onError("Не удалось получить статус от Telegram"),
  });

  const toggle = useMutation({
    mutationFn: () => botsApi.update(bot.id, { is_active: !bot.is_active }),
    onSuccess: (b) => {
      onBot(b);
      qc.invalidateQueries({ queryKey: ["bots"] });
      toast.success(b.is_active ? "Бот включён" : "Бот выключен");
    },
    onError: onError("Не удалось изменить статус"),
  });

  const remove = useMutation({
    mutationFn: () => botsApi.remove(bot.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      toast.success(`Бот @${bot.username} отключён от платформы`);
      router.push("/bots");
    },
    onError: onError("Не удалось удалить бота"),
  });

  const status = WEBHOOK_STATUS[bot.webhook_status];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">Подключение к Telegram</h3>
          <WebhookStatusBadge status={bot.webhook_status} />
        </div>
        <p className="text-sm text-[#636366]">{status.hint}</p>
        {bot.webhook_error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{bot.webhook_error}</p>
        )}
        <p className="text-xs text-[#8e8e93]">
          Последнее сообщение от подписчиков: {formatDateTime(bot.last_update_at)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reconnect.mutate()}
            disabled={!bot.is_active || reconnect.isPending}
          >
            {reconnect.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Переподключить
          </Button>
          <Button variant="outline" size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="mr-1.5 h-4 w-4" />
            )}
            Проверить в Telegram
          </Button>
        </div>
        {info && (
          <dl className="grid gap-x-6 gap-y-1 rounded-xl bg-black/[0.03] p-4 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-[#8e8e93]">Адрес вебхука</dt>
            <dd>{info.url_set ? "✅ настроен на эту платформу" : "❌ не настроен"}</dd>
            <dt className="text-[#8e8e93]">В очереди</dt>
            <dd>{info.pending_update_count} сообщ.</dd>
            {info.last_error_message && (
              <>
                <dt className="text-[#8e8e93]">Последняя ошибка</dt>
                <dd className="text-red-700">
                  {info.last_error_message} · {formatDateTime(info.last_error_date)}
                </dd>
              </>
            )}
          </dl>
        )}
      </section>

      <section className="space-y-3 border-t border-black/[0.06] pt-6">
        <h3 className="text-sm font-semibold">{bot.is_active ? "Выключить бота" : "Включить бота"}</h3>
        <p className="text-sm text-[#636366]">
          {bot.is_active
            ? "Бот перестанет отвечать, но подписчики и настройки сохранятся."
            : "Бот снова начнёт отвечать подписчикам."}
        </p>
        <Button variant="outline" size="sm" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
          <Power className="mr-1.5 h-4 w-4" />
          {bot.is_active ? "Выключить" : "Включить"}
        </Button>
      </section>

      <section className="space-y-3 border-t border-black/[0.06] pt-6">
        <h3 className="text-sm font-semibold text-red-700">Удалить бота с платформы</h3>
        <p className="text-sm text-[#636366]">
          Бот останется в Telegram, но платформа перестанет им управлять. Подписчики и настройки
          будут удалены без возможности восстановления.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Удалить
        </Button>
      </section>

      <Dialog open={confirmDelete} onOpenChange={(v) => !remove.isPending && setConfirmDelete(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить @{bot.username}?</DialogTitle>
            <DialogDescription>
              {bot.subscribers_count > 0
                ? `Будут удалены ${bot.subscribers_count} подписчиков и все настройки бота.`
                : "Все настройки бота будут удалены."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
