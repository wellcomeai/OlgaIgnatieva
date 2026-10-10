"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { ordersApi } from "@/api/shop";
import { OrderStatusBadge } from "@/components/shop/OrderStatusBadge";
import { formatRub } from "@/components/shop/price";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/errors";
import { cn, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const PAGE_SIZE = 25;
const FILTERS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "paid", label: "Оплаченные" },
  { id: "pending", label: "Ожидают оплаты" },
  { id: "all", label: "Все" },
];

export default function OrdersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<OrderStatus | "all">("paid");
  const [page, setPage] = useState(0);

  const { data: stats } = useQuery({ queryKey: ["order-stats"], queryFn: () => ordersApi.stats() });
  const { data, isLoading } = useQuery({
    queryKey: ["orders", filter, page],
    queryFn: () =>
      ordersApi.list({
        status: filter === "all" ? undefined : filter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const redeliver = useMutation({
    mutationFn: (id: string) => ordersApi.redeliver(id),
    onSuccess: () => {
      toast.success("Отправляем покупателю ещё раз");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["orders"] }), 2000);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось отправить")),
  });

  const total = data?.total ?? 0;
  const cards = [
    { label: "Выручка за 30 дней", value: formatRub(stats?.revenue_30d ?? 0) },
    { label: "Продаж за 30 дней", value: stats?.paid_count_30d ?? 0 },
    { label: "Выручка всего", value: formatRub(stats?.revenue ?? 0) },
  ];

  return (
    <>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.025em] text-[#171717]">Заказы</h1>
        <p className="text-sm text-[#8e8e93]">Оплаты через Робокассу и выдача файлов</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div className="text-[13px] text-[#8e8e93]">{c.label}</div>
            <div className="mt-1 text-[24px] font-extrabold tabular-nums tracking-[-0.025em] text-[#171717]">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === f.id
                  ? "bg-[#2B2E81] text-white"
                  : "bg-black/[0.04] text-[#636366] hover:bg-black/[0.07]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Заказов пока нет"
            description="Когда подписчик нажмёт «Оплатить» в боте, заказ появится здесь."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-[#8e8e93]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">№</th>
                  <th className="px-4 py-2.5 font-medium">Продукт</th>
                  <th className="px-4 py-2.5 font-medium">Покупатель</th>
                  <th className="px-4 py-2.5 font-medium">Сумма</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Дата</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {data.items.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-black/[0.015]">
                    <td className="px-4 py-3 tabular-nums text-[#8e8e93]">{o.inv_id}</td>
                    <td className="px-4 py-3 font-medium text-[#171717]">{o.product_title}</td>
                    <td className="px-4 py-3">
                      <div className="text-[#171717]">{o.subscriber_name ?? "—"}</div>
                      {o.subscriber_username && (
                        <a
                          href={`https://t.me/${o.subscriber_username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#069DDF] hover:underline"
                        >
                          @{o.subscriber_username}
                        </a>
                      )}
                      {o.bot_username && <div className="text-xs text-[#b0b0b8]">через @{o.bot_username}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{formatRub(o.amount)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge order={o} />
                      {o.delivery_error && <div className="mt-1 max-w-[220px] text-xs text-red-600">{o.delivery_error}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#636366]">
                      {formatDateTime(o.paid_at ?? o.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.status === "paid" && (
                        <button
                          onClick={() => redeliver.mutate(o.id)}
                          disabled={redeliver.isPending}
                          title="Отправить файлы покупателю ещё раз"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#2B2E81] transition hover:bg-[rgba(6,157,223,0.1)]"
                        >
                          <RotateCw className="h-3.5 w-3.5" /> Отправить ещё раз
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-[#636366]">
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
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
