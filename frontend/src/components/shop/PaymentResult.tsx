"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Send, XCircle } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";

const USERNAME_RE = /^[A-Za-z0-9_]{5,64}$/;

function Result({ ok }: { ok: boolean }) {
  const params = useSearchParams();
  const bot = params.get("Shp_bot");
  const botLink = bot && USERNAME_RE.test(bot) ? `https://t.me/${bot}` : null;
  const Icon = ok ? CheckCircle2 : XCircle;

  return (
    <div className="w-full max-w-md rounded-3xl border border-black/[0.07] bg-white p-8 text-center shadow-[0_20px_60px_rgba(43,46,129,0.12)]">
      <div
        className={
          ok
            ? "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
            : "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50"
        }
      >
        <Icon className={ok ? "h-8 w-8 text-emerald-600" : "h-8 w-8 text-red-600"} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#171717]">
        {ok ? "Оплата прошла!" : "Оплата не прошла"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#636366]">
        {ok
          ? "Спасибо за покупку. Материалы уже отправлены вам в Telegram — вернитесь в чат с ботом."
          : "Деньги не списаны. Вернитесь в бот и попробуйте оплатить ещё раз — ссылка на оплату там же."}
      </p>
      {botLink && (
        <a
          href={botLink}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2B2E81] font-semibold text-white transition hover:bg-[#22256B]"
        >
          <Send className="h-4 w-4" /> Вернуться в Telegram
        </a>
      )}
    </div>
  );
}

export function PaymentResult({ ok }: { ok: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[rgba(6,157,223,0.08)] to-white px-4 py-12">
      <BrandLogo size={34} />
      <Suspense fallback={null}>
        <Result ok={ok} />
      </Suspense>
    </div>
  );
}
