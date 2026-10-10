import type { Order } from "@/types";
import { cn } from "@/lib/utils";

/** Статус заказа с учётом выдачи: ожидает оплаты → оплачен → выдан / ошибка выдачи. */
export function orderState(order: Order): { label: string; className: string } {
  if (order.status === "pending") {
    return { label: "Ожидает оплаты", className: "bg-zinc-100 text-zinc-600" };
  }
  if (order.delivered_at) return { label: "Оплачен и выдан", className: "bg-emerald-50 text-emerald-700" };
  if (order.delivery_error) return { label: "Ошибка выдачи", className: "bg-red-50 text-red-700" };
  return { label: "Оплачен, выдаётся", className: "bg-amber-50 text-amber-700" };
}

export function OrderStatusBadge({ order }: { order: Order }) {
  const s = orderState(order);
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", s.className)}>
      {s.label}
    </span>
  );
}
