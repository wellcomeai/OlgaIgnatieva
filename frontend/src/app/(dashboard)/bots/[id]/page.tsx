"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Link2, MessageSquareText, Settings2, Users, Workflow } from "lucide-react";

import { botsApi } from "@/api/bots";
import { BotAvatar } from "@/components/bots/BotAvatar";
import { BotSettings } from "@/components/bots/BotSettings";
import { SourceLinks } from "@/components/bots/SourceLinks";
import { SubscribersTable } from "@/components/bots/SubscribersTable";
import { WebhookStatusBadge } from "@/components/bots/WebhookStatusBadge";
import { WelcomeEditor } from "@/components/bots/WelcomeEditor";
import { FlowsTab } from "@/components/flows/FlowsTab";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "flows", label: "Воронки", icon: Workflow },
  { id: "welcome", label: "Приветствие", icon: MessageSquareText },
  { id: "links", label: "Ссылки и метки", icon: Link2 },
  { id: "subscribers", label: "Подписчики", icon: Users },
  { id: "settings", label: "Настройки", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BotPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const initialTab = TABS.find((t) => t.id === search.get("tab"))?.id ?? "flows";
  const [tab, setTab] = useState<TabId>(initialTab);
  const { data: bot, isLoading, isError } = useQuery({
    queryKey: ["bot", id],
    queryFn: () => botsApi.get(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !bot) {
    return (
      <EmptyState
        icon={Users}
        title="Бот не найден"
        description="Возможно, он был удалён."
        action={{ label: "Ко всем ботам", href: "/bots" }}
      />
    );
  }

  return (
    <>
      <Link
        href="/bots"
        className="inline-flex items-center gap-1 text-sm text-[#8e8e93] transition hover:text-[#171717]"
      >
        <ArrowLeft className="h-4 w-4" /> Все боты
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <BotAvatar botId={bot.id} name={bot.first_name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[26px] font-extrabold tracking-[-0.025em] text-[#171717]">
              {bot.first_name}
            </h1>
            <WebhookStatusBadge status={bot.webhook_status} />
          </div>
          <a
            href={`https://t.me/${bot.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#069DDF] hover:underline"
          >
            t.me/{bot.username} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-3 text-right shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="text-2xl font-extrabold tabular-nums tracking-tight text-[#171717]">
            {bot.subscribers_count}
          </div>
          <div className="text-xs text-[#8e8e93]">подписчиков</div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-black/[0.07]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
                active
                  ? "border-[#2B2E81] text-[#2B2E81]"
                  : "border-transparent text-[#8e8e93] hover:text-[#171717]",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {tab === "flows" && <FlowsTab bot={bot} />}
        {tab === "welcome" && <WelcomeEditor bot={bot} />}
        {tab === "links" && <SourceLinks bot={bot} />}
        {tab === "subscribers" && <SubscribersTable bot={bot} />}
        {tab === "settings" && <BotSettings bot={bot} />}
      </div>
    </>
  );
}
