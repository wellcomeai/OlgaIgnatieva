"use client";

import Link from "next/link";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { SELLER_STATUS, useSite } from "./useSite";

export const CONTACTS = {
  telegram: "https://t.me/schengenru",
  whatsapp: "https://wa.me/79957974730",
  channel: "https://t.me/visanewstoyou",
  site: "https://visanewstoyou.ru/",
};

export function SiteHeader({ cta }: { cta?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B1F3A]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="На главную">
          <BrandLogo size={30} tone="dark" />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm text-white/70 md:flex">
          <a href="/#inside" className="hover:text-white">Что внутри</a>
          <a href="/#author" className="hover:text-white">Автор</a>
          <a href="/#faq" className="hover:text-white">Вопросы</a>
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
    <footer className="bg-[#081629] text-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <BrandLogo size={28} tone="dark" />
          <p className="text-white/50">Визовое агентство VisaNews2U. Пошаговые гайды и сопровождение при получении виз.</p>
        </div>
        <div className="space-y-2">
          <div className="font-semibold text-white">Документы</div>
          <Link href="/offer" className="block hover:text-white">Публичная оферта</Link>
          <Link href="/terms" className="block hover:text-white">Пользовательское соглашение</Link>
          <Link href="/privacy" className="block hover:text-white">Политика конфиденциальности</Link>
          <a href={CONTACTS.channel} target="_blank" rel="noreferrer" className="block hover:text-white">Telegram-канал</a>
        </div>
        <div className="space-y-1.5">
          <div className="font-semibold text-white">Продавец</div>
          {s?.name ? (
            <>
              <div>{s.name}</div>
              <div className="text-white/40">{SELLER_STATUS[s.status] ?? ""}</div>
              {s.inn && <div>ИНН {s.inn}</div>}
              {s.ogrn && <div>{s.status === "company" ? "ОГРН" : "ОГРНИП"} {s.ogrn}</div>}
              {s.address && <div>{s.address}</div>}
              {s.email && (
                <a href={`mailto:${s.email}`} className="block hover:text-white">
                  {s.email}
                </a>
              )}
              {s.phone && <div>{s.phone}</div>}
            </>
          ) : (
            <div className="text-white/40">Реквизиты появятся после заполнения в кабинете.</div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-5 text-xs text-white/40 sm:px-6">
          <span>© {new Date().getFullYear()} VisaNews2U</span>
          <span>·</span>
          <span>Оплата через Робокассу: банковские карты, СБП</span>
          <Link href="/login" className="ml-auto hover:text-white/70">Вход для владельца</Link>
        </div>
      </div>
    </footer>
  );
}
