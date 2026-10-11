"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";
import { C } from "./theme";
import { SELLER_STATUS, useSite } from "./useSite";

export const CONTACTS = {
  telegram: "https://t.me/schengenru",
  whatsapp: "https://wa.me/79957974730",
  channel: "https://t.me/visanewstoyou",
  site: "https://visanewstoyou.ru/",
};

export function SiteHeader({ cta }: { cta?: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-white/90 backdrop-blur transition-shadow duration-300",
        scrolled ? "shadow-[0_1px_0_#E5E8EE,0_8px_24px_rgba(15,27,45,0.06)]" : "shadow-[0_1px_0_transparent]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="На главную" className="shrink-0">
          <BrandLogo size={28} />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 text-[14px] md:flex" style={{ color: C.text }}>
          <a href="/#inside" className="transition-colors hover:text-[#0F1B2D]">Что внутри</a>
          <a href="/#steps" className="transition-colors hover:text-[#0F1B2D]">Шаги</a>
          <a href="/#author" className="transition-colors hover:text-[#0F1B2D]">Автор</a>
          <a href="/#faq" className="transition-colors hover:text-[#0F1B2D]">Вопросы</a>
        </nav>
        <div className="ml-auto md:ml-0">{cta}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { data } = useSite();
  const s = data?.seller;
  return (
    <footer style={{ background: C.ink, color: C.onDarkMuted }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-[14px] sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandLogo size={26} tone="dark" />
          <p className="max-w-xs leading-relaxed">
            Визовое агентство VisaNews2U. Пошаговые гайды и сопровождение при получении виз.
          </p>
        </div>
        <div className="space-y-2.5">
          <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white/40">Документы</div>
          <Link href="/offer" className="block transition-colors hover:text-white">Публичная оферта</Link>
          <Link href="/terms" className="block transition-colors hover:text-white">Пользовательское соглашение</Link>
          <Link href="/privacy" className="block transition-colors hover:text-white">Политика конфиденциальности</Link>
        </div>
        <div className="space-y-1.5">
          <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white/40">Продавец</div>
          {s?.name ? (
            <>
              <div className="text-white/80">{s.name}</div>
              <div>{SELLER_STATUS[s.status] ?? ""}</div>
              {s.inn && <div>ИНН {s.inn}</div>}
              {s.ogrn && <div>{s.status === "company" ? "ОГРН" : "ОГРНИП"} {s.ogrn}</div>}
              {s.address && <div>{s.address}</div>}
              {s.email && (
                <a href={`mailto:${s.email}`} className="block transition-colors hover:text-white">{s.email}</a>
              )}
              {s.phone && <div>{s.phone}</div>}
            </>
          ) : (
            <div>Реквизиты появятся после заполнения в кабинете.</div>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.onDarkLine}` }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-5 text-[12px] text-white/40 sm:px-8">
          <span>© {new Date().getFullYear()} VisaNews2U</span>
          <span>Оплата через Робокассу — банковские карты и СБП</span>
          <Link href="/login" className="ml-auto transition-colors hover:text-white/70">Вход для владельца</Link>
        </div>
      </div>
    </footer>
  );
}
