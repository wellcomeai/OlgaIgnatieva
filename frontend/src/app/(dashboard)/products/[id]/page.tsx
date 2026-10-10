"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Link2, Loader2, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { productsApi } from "@/api/shop";
import { ProductEditor } from "@/components/shop/ProductEditor";
import { ProductFiles } from "@/components/shop/ProductFiles";
import { formatRub } from "@/components/shop/price";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/errors";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-bold tracking-[-0.015em] text-[#171717]">{title}</h2>
      {hint && <p className="mt-1 text-sm text-[#8e8e93]">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id),
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: () => productsApi.update(id, { is_active: !product!.is_active }),
    onSuccess: (p) => {
      qc.setQueryData(["product", id], p);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(p.is_active ? "Продукт снова продаётся" : "Продукт скрыт — бот его не продаёт");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось изменить статус")),
  });

  const remove = useMutation({
    mutationFn: () => productsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Продукт удалён");
      router.push("/products");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось удалить")),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !product) {
    return (
      <EmptyState
        icon={Package}
        title="Продукт не найден"
        description="Возможно, он был удалён."
        action={{ label: "Ко всем продуктам", href: "/products" }}
      />
    );
  }

  return (
    <>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-[#8e8e93] transition hover:text-[#171717]"
      >
        <ArrowLeft className="h-4 w-4" /> Все продукты
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#171717]">{product.title}</h1>
          <p className="text-sm text-[#8e8e93]">
            {formatRub(product.price)} · {product.is_active ? "продаётся" : "скрыт"}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-3 text-right shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="text-2xl font-extrabold tabular-nums text-[#171717]">{product.sales_count}</div>
            <div className="text-xs text-[#8e8e93]">продаж</div>
          </div>
          <div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-3 text-right shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="text-2xl font-extrabold tabular-nums text-[#171717]">{formatRub(product.revenue)}</div>
            <div className="text-xs text-[#8e8e93]">выручка</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Описание и цена">
            <ProductEditor product={product} />
          </Section>
          <Section title="Файлы" hint="Бот отправит их покупателю сразу после оплаты.">
            <ProductFiles product={product} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Как продавать" hint="Поделитесь ссылкой — бот сразу покажет карточку товара с кнопкой оплаты.">
            {product.buy_links.length === 0 ? (
              <p className="text-sm text-[#636366]">
                Сначала{" "}
                <Link href="/bots" className="font-medium text-[#2B2E81] hover:underline">
                  подключите бота
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {product.buy_links.map((link) => (
                  <div
                    key={link}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(6,157,223,0.25)] bg-[rgba(6,157,223,0.05)] px-3 py-2"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-[#069DDF]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#2B2E81]">
                      {link.replace("https://", "")}
                    </span>
                    <CopyButton value={link} message="Ссылка скопирована" />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-[#8e8e93]">
              Ещё можно добавить кнопку «Купить» в приветствие бота: Боты → Приветствие → Продукты.
            </p>
          </Section>

          <Section title="Управление">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
                {product.is_active ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {product.is_active ? "Снять с продажи" : "Вернуть в продажу"}
              </Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Удалить продукт
              </Button>
            </div>
          </Section>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(v) => !remove.isPending && setConfirmDelete(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить «{product.title}»?</DialogTitle>
            <DialogDescription>
              Файлы будут удалены. История заказов сохранится. Если хотите просто временно не
              продавать — лучше «Снять с продажи».
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
    </>
  );
}
