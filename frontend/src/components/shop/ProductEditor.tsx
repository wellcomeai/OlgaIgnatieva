"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { productsApi } from "@/api/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/errors";
import type { ProductDetail } from "@/types";
import { normalizePrice } from "./price";

function toForm(p: ProductDetail) {
  return {
    title: p.title,
    price: Number(p.price).toString().replace(".", ","),
    description: p.description,
    delivery_message: p.delivery_message,
    protect_content: p.protect_content,
  };
}

export function ProductEditor({ product }: { product: ProductDetail }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => toForm(product));
  // Сбрасываем форму только когда изменились сами поля продукта (а не, например,
  // список файлов после загрузки) — иначе несохранённые правки пропадут.
  const savedKey = JSON.stringify(toForm(product));
  useEffect(() => setForm(JSON.parse(savedKey)), [savedKey]);

  const initial = toForm(product);
  const dirty = JSON.stringify(form) !== savedKey;
  const price = normalizePrice(form.price);
  const valid = form.title.trim() && price && form.delivery_message.trim();

  const save = useMutation({
    mutationFn: () =>
      productsApi.update(product.id, {
        title: form.title.trim(),
        price: price!,
        description: form.description,
        delivery_message: form.delivery_message,
        protect_content: form.protect_content,
      }),
    onSuccess: (p) => {
      qc.setQueryData(["product", product.id], p);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Продукт сохранён");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось сохранить")),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="p-title">Название</Label>
          <Input id="p-title" value={form.title} maxLength={255} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-price">Цена, ₽</Label>
          <Input
            id="p-price"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          {!price && <p className="text-xs text-red-600">От 1 до 1 000 000 ₽</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-desc">Описание в боте</Label>
        <Textarea
          id="p-desc"
          rows={4}
          maxLength={3000}
          placeholder="Что внутри, кому подойдёт, сколько страниц или минут"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <p className="text-xs text-[#8e8e93]">
          Показывается в карточке товара перед кнопкой «Оплатить». Можно использовать &lt;b&gt;жирный&lt;/b&gt;.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-delivery">Сообщение после оплаты</Label>
        <Textarea
          id="p-delivery"
          rows={3}
          maxLength={4096}
          value={form.delivery_message}
          onChange={(e) => set("delivery_message", e.target.value)}
        />
        <p className="text-xs text-[#8e8e93]">
          Бот отправит его вместе с файлами. {"{first_name}"} заменится на имя покупателя.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.07] p-3.5">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#2B2E81]"
          checked={form.protect_content}
          onChange={(e) => set("protect_content", e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium">Запретить пересылку и сохранение</span>
          <span className="block text-xs text-[#8e8e93]">
            Покупатель не сможет переслать файлы другим людям или сохранить их из Telegram.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 border-t border-black/[0.06] pt-5">
        <Button onClick={() => save.mutate()} disabled={!dirty || !valid || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
        {dirty ? (
          <Button variant="ghost" onClick={() => setForm(initial)}>
            Отменить
          </Button>
        ) : (
          <span className="text-xs text-[#8e8e93]">Все изменения сохранены</span>
        )}
      </div>
    </div>
  );
}
