"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { productsApi } from "@/api/shop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/errors";
import { normalizePrice } from "./price";

export function CreateProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const normalized = normalizePrice(price);

  const create = useMutation({
    mutationFn: () => productsApi.create({ title: title.trim(), price: normalized! }),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      setTitle("");
      setPrice("");
      router.push(`/products/${product.id}`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось создать продукт")),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый продукт</DialogTitle>
          <DialogDescription>Файлы и описание добавите на следующем шаге.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="product-title">Название</Label>
            <Input
              id="product-title"
              placeholder="Гайд «Шенген за 7 дней»"
              value={title}
              maxLength={255}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-price">Цена, ₽</Label>
            <Input
              id="product-price"
              inputMode="decimal"
              placeholder="990"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {price && !normalized && (
              <p className="text-xs text-red-600">Введите сумму от 1 до 1 000 000 ₽, например 990 или 1490,50</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={!title.trim() || !normalized || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
