"use client";

import { SiteFooter, SiteHeader } from "./SiteShell";
import { SELLER_STATUS, req, useSite } from "./useSite";
import type { SiteInfo } from "@/types";

export function LegalPage({
  title,
  edition,
  children,
}: {
  title: string;
  edition: string;
  children: (ctx: { s: SiteInfo["seller"]; site: string; v: (val: string, label: string) => React.ReactNode }) => React.ReactNode;
}) {
  const { data } = useSite();
  const s = data?.seller ?? { status: "self_employed", name: "", inn: "", ogrn: "", address: "", email: "", phone: "" };
  const site = data?.site_url ?? "";
  // Незаполненный реквизит подсвечивается, чтобы владелец сразу увидел пробел
  const v = (val: string, label: string) =>
    val?.trim() ? <span>{val}</span> : <mark className="rounded bg-amber-100 px-1 text-amber-900">{req(val, label)}</mark>;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-[#0F1B2D] sm:text-[40px]">{title}</h1>
        <p className="mt-2 text-sm text-[#64748B]">Редакция от {edition}</p>
        <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-[#334155] [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#0F1B2D] [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[#334155]">
          {children({ s, site, v })}
        </article>
        <section className="mt-12 rounded-2xl bg-[#F5F7FA] p-6 text-sm">
          <h2 className="mb-2 font-semibold text-[#0F1B2D]">Реквизиты</h2>
          <div className="space-y-1 text-[#334155]">
            <div>{v(s.name, "ФИО / наименование")}</div>
            <div>{SELLER_STATUS[s.status] ?? ""}</div>
            <div>ИНН: {v(s.inn, "ИНН")}</div>
            {s.status !== "self_employed" && (
              <>
                <div>
                  {s.status === "company" ? "ОГРН" : "ОГРНИП"}: {v(s.ogrn, s.status === "company" ? "ОГРН" : "ОГРНИП")}
                </div>
                <div>Адрес: {v(s.address, "адрес")}</div>
              </>
            )}
            <div>Email: {v(s.email, "email")}</div>
            {s.phone && <div>Телефон: {s.phone}</div>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
