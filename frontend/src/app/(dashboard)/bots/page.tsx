"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bot as BotIcon, Plus, Users } from "lucide-react";

import { botsApi } from "@/api/bots";
import { BotAvatar } from "@/components/bots/BotAvatar";
import { ConnectBotDialog } from "@/components/bots/ConnectBotDialog";
import { WebhookStatusBadge } from "@/components/bots/WebhookStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function BotsPage() {
  const [connectOpen, setConnectOpen] = useState(false);
  const { data: bots, isLoading } = useQuery({
    queryKey: ["bots"],
    queryFn: () => botsApi.list(),
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.025em] text-[#171717]">Боты</h1>
          <p className="text-sm text-[#8e8e93]">Ваши Telegram-боты и их подписчики</p>
        </div>
        {bots && bots.length > 0 && (
          <Button onClick={() => setConnectOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Подключить бота
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !bots || bots.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[rgba(6,157,223,0.35)] bg-gradient-to-b from-[rgba(6,157,223,0.06)] to-transparent px-6 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#069DDF] to-[#2B2E81] shadow-[0_10px_30px_rgba(43,46,129,0.3)]">
            <BotIcon className="h-8 w-8 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Подключите первого бота</h2>
          <p className="mt-2 max-w-md text-sm text-[#636366]">
            Создайте бота в @BotFather, вставьте токен — и бот сразу начнёт приветствовать
            подписчиков и собирать базу.
          </p>
          <Button size="lg" className="mt-6" onClick={() => setConnectOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Подключить бота
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Link
              key={bot.id}
              href={`/bots/${bot.id}`}
              className="group rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(6,157,223,0.35)] hover:shadow-[0_12px_32px_rgba(43,46,129,0.1)]"
            >
              <div className="flex items-start gap-3">
                <BotAvatar botId={bot.id} name={bot.first_name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[#171717]">{bot.first_name}</div>
                  <div className="truncate text-sm text-[#069DDF]">@{bot.username}</div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <WebhookStatusBadge status={bot.webhook_status} />
                <span className="flex items-center gap-1.5 text-sm text-[#636366]">
                  <Users className="h-4 w-4" />
                  <span className="tabular-nums">{bot.subscribers_count}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ConnectBotDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}
