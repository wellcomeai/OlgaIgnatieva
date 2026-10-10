"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";

import { flowsApi } from "@/api/flows";
import { productsApi } from "@/api/shop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/errors";
import { cn, formatDate } from "@/lib/utils";
import type { Bot, FlowSummary, FlowTemplate } from "@/types";
import { triggerText } from "./graph";

const TEMPLATES: { id: FlowTemplate; title: string; text: string }[] = [
  { id: "blank", title: "С нуля", text: "Только старт — соберите свою схему" },
  { id: "welcome_sale", title: "Приветствие и продажа", text: "Кнопка «Хочу» → продажа → через сутки дожим, если не купил" },
  { id: "lead_magnet", title: "Лид-магнит", text: "Подарок за email → тег «лид» → через час предложение продукта" },
];

function CreateFlowDialog({ bot, open, onOpenChange }: { bot: Bot; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<FlowTemplate>("welcome_sale");
  const create = useMutation({
    mutationFn: () => flowsApi.create(bot.id, name.trim() || TEMPLATES.find((t) => t.id === template)!.title, template),
    onSuccess: (f) => router.push(`/flows/${f.id}`),
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось создать воронку")),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новая воронка</DialogTitle>
          <DialogDescription>Начните с шаблона — всё можно поменять в редакторе.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="flow-name">Название</Label>
            <Input id="flow-name" placeholder="Например, «Гайд по шенгену»" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  template === t.id ? "border-[#069DDF] bg-[rgba(6,157,223,0.05)]" : "border-black/[0.08] hover:border-black/[0.15]",
                )}
              >
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="text-xs text-[#8e8e93]">{t.text}</div>
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать и открыть редактор
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FlowsTab({ bot }: { bot: Bot }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: flows, isLoading } = useQuery({ queryKey: ["flows", bot.id], queryFn: () => flowsApi.list(bot.id) });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["flows", bot.id] });
  const toggle = useMutation({
    mutationFn: (f: FlowSummary) => flowsApi.update(f.id, { is_active: !f.is_active }),
    onSuccess: (f) => {
      refresh();
      toast.success(f.is_active ? `«${f.name}» включена` : `«${f.name}» выключена`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось изменить статус"), { duration: 8000 }),
  });
  const remove = useMutation({
    mutationFn: (f: FlowSummary) => flowsApi.remove(f.id),
    onSuccess: () => {
      refresh();
      toast.success("Воронка удалена");
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-[#636366]">
          Воронка — это сценарий: сообщения, паузы, вопросы, продажи и развилки. Активная воронка «на любой
          /start» заменяет обычное приветствие.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Новая воронка
        </Button>
      </div>

      {!flows || flows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[rgba(6,157,223,0.35)] bg-[rgba(6,157,223,0.04)] px-6 py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#069DDF] to-[#2B2E81]">
            <Workflow className="h-7 w-7 text-white" />
          </div>
          <div className="font-semibold">Пока нет воронок</div>
          <p className="mt-1 max-w-sm text-sm text-[#636366]">
            Соберите первую из шаблона за пару минут: приветствие, продажа и автоматический дожим.
          </p>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Создать воронку
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {flows.map((f) => {
            const product = products.find((p) => p.id === f.trigger_value);
            return (
              <div key={f.id} className="rounded-2xl border border-black/[0.07] p-4 transition hover:border-[rgba(6,157,223,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/flows/${f.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[#171717] hover:text-[#2B2E81]">{f.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[#8e8e93]">
                      <Zap className="h-3 w-3" /> {triggerText(f.trigger_kind, f.trigger_value, product?.title)}
                    </div>
                  </Link>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={f.is_active}
                    aria-label={f.is_active ? "Выключить" : "Включить"}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(f)}
                    className={cn("relative h-6 w-11 shrink-0 rounded-full transition", f.is_active ? "bg-emerald-500" : "bg-zinc-300")}
                  >
                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", f.is_active ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-[#636366]">
                  <span className="flex items-center gap-1" title="Сколько людей вошло в воронку">
                    <Users className="h-3.5 w-3.5" /> {f.entered} вошло
                  </span>
                  <span title="Ждут паузы, нажатия кнопки или ответа">{f.in_progress} в процессе</span>
                  <span className="ml-auto">изм. {formatDate(f.updated_at)}</span>
                  <button
                    type="button"
                    aria-label="Удалить воронку"
                    onClick={() => window.confirm(`Удалить воронку «${f.name}»?`) && remove.mutate(f)}
                    className="rounded p-1 text-[#b0b0b8] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Link href={`/flows/${f.id}`} className="mt-3 block rounded-lg bg-black/[0.03] py-2 text-center text-sm font-medium text-[#2B2E81] hover:bg-[rgba(6,157,223,0.1)]">
                  Открыть редактор
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <CreateFlowDialog bot={bot} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
