"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot as BotIcon, Plus, ShoppingBag, Users, Wallet } from "lucide-react";

import { botsApi } from "@/api/bots";
import { ordersApi } from "@/api/shop";
import { formatRub } from "@/components/shop/price";
import { EmailBanner } from "@/components/EmailBanner";
import { BotAvatar } from "@/components/bots/BotAvatar";
import { WebhookStatusBadge } from "@/components/bots/WebhookStatusBadge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: bots = [] } = useQuery({
    queryKey: ["bots"],
    queryFn: () => botsApi.list(),
  });

  const { data: orderStats } = useQuery({
    queryKey: ["order-stats"],
    queryFn: () => ordersApi.stats(),
  });

  const subscribers = bots.reduce((acc, b) => acc + b.subscribers_count, 0);
  const name = user?.profile?.first_name;

  const stats = [
    { label: "Выручка за 30 дней", value: formatRub(orderStats?.revenue_30d ?? 0), icon: Wallet, href: "/orders" },
    { label: "Продаж за 30 дней", value: orderStats?.paid_count_30d ?? 0, icon: ShoppingBag, href: "/orders" },
    { label: "Подписчиков", value: subscribers, icon: Users, href: "/bots" },
    { label: "Ботов", value: bots.length, icon: BotIcon, href: "/bots" },
  ];

  return (
    <>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.025em] text-[#171717]">
          {name ? `Здравствуйте, ${name}!` : "Главная"}
        </h1>
        <p className="text-sm text-[#8e8e93]">Продажи и боты</p>
      </div>

      <EmailBanner />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-start gap-4 rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition hover:border-[rgba(6,157,223,0.35)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(6,157,223,0.1)]">
                <Icon className="h-5 w-5 text-[#2B2E81]" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-[13px] text-[#8e8e93]">{s.label}</div>
                <div className="text-[26px] font-extrabold tabular-nums tracking-[-0.025em] text-[#171717]">
                  {s.value}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-[-0.015em] text-[#171717]">Боты</h2>
          {bots.length > 0 && (
            <Link href="/bots" className="flex items-center gap-1 text-sm text-[#2B2E81] hover:underline">
              Все боты <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {bots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[#636366]">
              Подключите Telegram-бота — это первый шаг к вашей воронке.
            </p>
            <Button asChild>
              <Link href="/bots">
                <Plus className="mr-1.5 h-4 w-4" /> Подключить бота
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {bots.slice(0, 5).map((bot) => (
              <li key={bot.id}>
                <Link
                  href={`/bots/${bot.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-black/[0.02]"
                >
                  <BotAvatar botId={bot.id} name={bot.first_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[#171717]">{bot.first_name}</div>
                    <div className="truncate text-xs text-[#069DDF]">@{bot.username}</div>
                  </div>
                  <WebhookStatusBadge status={bot.webhook_status} className="hidden sm:inline-flex" />
                  <span className="w-16 text-right text-sm tabular-nums text-[#636366]">
                    {bot.subscribers_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
