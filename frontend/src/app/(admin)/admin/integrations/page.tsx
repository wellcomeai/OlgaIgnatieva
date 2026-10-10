"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { integrationsApi } from "@/api/integrations";
import { RobokassaStatus } from "@/components/shop/RobokassaStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/errors";
import type { IntegrationField } from "@/types";

type Draft = Record<string, string | boolean>;

function initialDraft(fields: IntegrationField[]): Draft {
  const d: Draft = {};
  for (const f of fields) {
    if (f.secret) d[f.key] = "";
    else if (f.type === "bool") d[f.key] = Boolean(f.value);
    else d[f.key] = (f.value as string) ?? "";
  }
  return d;
}

const SOURCE_LABEL: Record<IntegrationField["source"], string> = {
  ui: "задано в кабинете",
  env: "из настроек сервера",
  none: "не задано",
};

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => integrationsApi.get() });
  const fields = useMemo(() => data?.robokassa ?? [], [data]);
  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => setDraft(initialDraft(fields)), [fields]);

  const changed = useMemo(() => {
    const init = initialDraft(fields);
    return Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== init[k]));
  }, [draft, fields]);

  const onSaved = (state: Awaited<ReturnType<typeof integrationsApi.get>>) => {
    qc.setQueryData(["integrations"], state);
    qc.invalidateQueries({ queryKey: ["payments-config"] });
  };

  const save = useMutation({
    mutationFn: () => integrationsApi.update(changed),
    onSuccess: (s) => {
      onSaved(s);
      toast.success("Настройки сохранены");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось сохранить")),
  });

  const reset = useMutation({
    mutationFn: (key: string) => integrationsApi.update({}, [key]),
    onSuccess: (s) => {
      onSaved(s);
      toast.success("Возвращено значение из настроек сервера");
    },
  });

  const set = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));
  const main = fields.filter((f) => ["robokassa_merchant_login", "robokassa_password1", "robokassa_password2", "robokassa_test_mode"].includes(f.key));
  const receipt = fields.filter((f) => !main.includes(f));

  function renderField(f: IntegrationField) {
    const val = draft[f.key];
    return (
      <div key={f.key} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <span className="flex items-center gap-1 text-[11px] text-[#8e8e93]">
            {SOURCE_LABEL[f.source]}
            {f.source === "ui" && (
              <button
                type="button"
                title="Вернуть значение из настроек сервера"
                onClick={() => reset.mutate(f.key)}
                className="rounded p-0.5 hover:bg-black/[0.05]"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </span>
        </div>
        {f.type === "bool" ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[0.08] px-3 py-2.5">
            <input
              id={f.key}
              type="checkbox"
              className="h-4 w-4 accent-[#2B2E81]"
              checked={Boolean(val)}
              onChange={(e) => set(f.key, e.target.checked)}
            />
            <span className="text-sm">{val ? "Включено" : "Выключено"}</span>
          </label>
        ) : f.type === "choice" ? (
          <select
            id={f.key}
            value={String(val ?? "")}
            onChange={(e) => set(f.key, e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {f.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="relative">
            <Input
              id={f.key}
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              placeholder={f.secret ? (f.is_set ? "•••••••• задан — введите новый, чтобы заменить" : "Не задан") : ""}
              value={String(val ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              className={f.secret && f.is_set ? "pr-9" : ""}
            />
            {f.secret && f.is_set && (
              <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            )}
          </div>
        )}
        {f.help && <p className="text-xs text-[#8e8e93]">{f.help}</p>}
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.025em] text-[#171717]">Интеграции</h1>
        <p className="text-sm text-[#8e8e93]">Ключи и параметры сервисов — без доступа к серверу</p>
      </div>

      <RobokassaStatus />

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <section className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#2B2E81]" />
              <h2 className="text-[15px] font-bold">Робокасса</h2>
            </div>
            <p className="mb-5 text-sm text-[#636366]">
              Данные — в кабинете Робокассы → «Мои магазины» → «Технические настройки». Пароли хранятся
              зашифрованными и после сохранения не показываются.
            </p>
            <div className="grid gap-5 md:grid-cols-2">{main.map(renderField)}</div>
          </section>

          <section className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2 className="mb-1 text-[15px] font-bold">Чек (54-ФЗ)</h2>
            <p className="mb-5 text-sm text-[#636366]">
              Если касса в Робокассе уже настроена на номенклатуру по умолчанию — оставьте передачу чека выключенной.
            </p>
            <div className="grid gap-5 md:grid-cols-2">{receipt.map(renderField)}</div>
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={Object.keys(changed).length === 0 || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
            {Object.keys(changed).length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setDraft(initialDraft(fields))}>
                Отменить
              </Button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
