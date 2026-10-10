"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";

import { botsApi } from "@/api/bots";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import type { Bot } from "@/types";

const PAGE_SIZE = 20;

export function SubscribersTable({ bot }: { bot: Bot }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["bot-subscribers", bot.id, query, page],
    queryFn: () =>
      botsApi.subscribers(bot.id, {
        search: query || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
        <Input
          placeholder="Имя, @ник или метка"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "Никого не нашли" : "Подписчиков пока нет"}
          description={
            query
              ? "Попробуйте другой запрос."
              : `Откройте t.me/${bot.username} и нажмите «Старт» — вы станете первым.`
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-[#8e8e93]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Подписчик</th>
                <th className="px-4 py-2.5 font-medium">Метка</th>
                <th className="px-4 py-2.5 font-medium">Пришёл</th>
                <th className="px-4 py-2.5 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {data.items.map((s) => {
                const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || "Без имени";
                return (
                  <tr key={s.id} className="hover:bg-black/[0.015]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#171717]">{name}</div>
                      {s.username && (
                        <a
                          href={`https://t.me/${s.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#069DDF] hover:underline"
                        >
                          @{s.username}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.source ? (
                        <span className="rounded-full bg-[rgba(6,157,223,0.1)] px-2 py-0.5 text-xs font-medium text-[#2B2E81]">
                          {s.source}
                        </span>
                      ) : (
                        <span className="text-xs text-[#b0b0b8]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#636366]">
                      {formatDateTime(s.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_blocked ? (
                        <span className="text-xs text-red-600">Заблокировал бота</span>
                      ) : (
                        <span className="text-xs text-emerald-700">Активен</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-[#636366]">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} из {total}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-black/[0.08] px-3 py-1.5 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </button>
            <button
              className="rounded-lg border border-black/[0.08] px-3 py-1.5 disabled:opacity-40"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
