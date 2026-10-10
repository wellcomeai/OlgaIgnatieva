"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Package, Plus } from "lucide-react";

import { productsApi } from "@/api/shop";
import { CreateProductDialog } from "@/components/shop/CreateProductDialog";
import { RobokassaStatus } from "@/components/shop/RobokassaStatus";
import { formatRub } from "@/components/shop/price";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.025em] text-[#171717]">Продукты</h1>
          <p className="text-sm text-[#8e8e93]">Файлы, которые бот продаёт и выдаёт после оплаты</p>
        </div>
        {products && products.length > 0 && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Новый продукт
          </Button>
        )}
      </div>

      <RobokassaStatus />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[rgba(6,157,223,0.35)] bg-gradient-to-b from-[rgba(6,157,223,0.06)] to-transparent px-6 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#069DDF] to-[#2B2E81] shadow-[0_10px_30px_rgba(43,46,129,0.3)]">
            <Package className="h-8 w-8 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Создайте первый продукт</h2>
          <p className="mt-2 max-w-md text-sm text-[#636366]">
            Гайд, чек-лист, видеоурок — загрузите файлы и укажите цену. Бот примет оплату через
            Робокассу и сам отправит файлы покупателю.
          </p>
          <Button size="lg" className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Новый продукт
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className={cn(
                "group flex flex-col rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(6,157,223,0.35)] hover:shadow-[0_12px_32px_rgba(43,46,129,0.1)]",
                !p.is_active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 font-semibold text-[#171717]">{p.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-[#8e8e93]">
                    <FileText className="h-3.5 w-3.5" /> {p.files_count} файл.
                    {!p.is_active && <span className="ml-1 rounded bg-zinc-100 px-1.5 text-zinc-600">скрыт</span>}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl bg-[rgba(6,157,223,0.1)] px-2.5 py-1 text-sm font-bold text-[#2B2E81]">
                  {formatRub(p.price)}
                </div>
              </div>
              <div className="mt-auto flex items-end justify-between pt-6">
                <div>
                  <div className="text-xs text-[#8e8e93]">Продаж</div>
                  <div className="text-lg font-bold tabular-nums text-[#171717]">{p.sales_count}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#8e8e93]">Выручка</div>
                  <div className="text-lg font-bold tabular-nums text-[#171717]">{formatRub(p.revenue)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProductDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
