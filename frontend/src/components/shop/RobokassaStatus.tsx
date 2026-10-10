"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, FlaskConical, ShieldCheck } from "lucide-react";

import { ordersApi } from "@/api/shop";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

function UrlRow({ label, value, method }: { label: string; value: string; method: string }) {
  return (
    <div className="grid items-center gap-1 sm:grid-cols-[110px_1fr_auto]">
      <span className="text-xs font-medium text-[#636366]">{label}</span>
      <code className="truncate rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-[12px] text-[#2B2E81]">
        {value}
      </code>
      <span className="flex items-center gap-1 text-[11px] text-[#8e8e93]">
        {method}
        <CopyButton value={value} message="Адрес скопирован" />
      </span>
    </div>
  );
}

/** Статус подключения Робокассы и адреса, которые нужно вставить в её кабинет. */
export function RobokassaStatus() {
  const { data } = useQuery({ queryKey: ["payments-config"], queryFn: () => ordersApi.paymentsConfig() });
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const tone = !data.robokassa_configured
    ? { icon: AlertTriangle, box: "border-amber-200 bg-amber-50", text: "text-amber-800" }
    : data.test_mode
      ? { icon: FlaskConical, box: "border-sky-200 bg-sky-50", text: "text-sky-800" }
      : { icon: ShieldCheck, box: "border-emerald-200 bg-emerald-50", text: "text-emerald-800" };
  const Icon = tone.icon;
  const title = !data.robokassa_configured
    ? "Робокасса не подключена — бот не сможет принимать оплату"
    : data.test_mode
      ? "Робокасса в тестовом режиме — деньги не списываются"
      : "Робокасса подключена — оплата работает";
  const expanded = open || !data.robokassa_configured;

  return (
    <div className={cn("rounded-2xl border p-4", tone.box)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("flex w-full items-center gap-2 text-left text-sm font-medium", tone.text)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 rounded-xl bg-white/70 p-4">
          {!data.robokassa_configured && (
            <p className="text-sm text-[#3a3a3c]">
              Укажите на сервере <code>ROBOKASSA_MERCHANT_LOGIN</code>, <code>ROBOKASSA_PASSWORD1</code> и{" "}
              <code>ROBOKASSA_PASSWORD2</code> из кабинета Робокассы.
            </p>
          )}
          <p className="text-sm text-[#3a3a3c]">
            В кабинете Робокассы → «Технические настройки» вставьте эти адреса:
          </p>
          <UrlRow label="Result URL" value={data.result_url} method="POST" />
          <UrlRow label="Success URL" value={data.success_url} method="GET" />
          <UrlRow label="Fail URL" value={data.fail_url} method="GET" />
          <p className="text-xs text-[#8e8e93]">
            Алгоритм подписи — MD5. Чек 54-ФЗ:{" "}
            {data.receipt_enabled ? "передаётся в ссылке на оплату" : "берётся из настроек магазина в Робокассе"}.
          </p>
        </div>
      )}
    </div>
  );
}
