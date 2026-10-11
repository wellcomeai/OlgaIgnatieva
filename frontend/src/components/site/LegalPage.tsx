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
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0B1F3A] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[#7a8294]">Редакция от {edition}</p>
        <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-[#1d2433] [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#0B1F3A] [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[#2d3445]">
          {children({ s, site, v })}
        </article>
        <section className="mt-10 rounded-2xl bg-[#F5F6FA] p-6 text-sm">
          <h2 className="mb-2 font-bold text-[#0B1F3A]">Реквизиты</h2>
          <div className="space-y-1 text-[#2d3445]">
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
