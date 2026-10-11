"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, CreditCard, FileText, MessageCircle, Send, ShieldCheck, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { CONTACTS, SiteFooter, SiteHeader } from "./SiteShell";
import { useSite } from "./useSite";

const NAVY = "#0B1F3A";
const RED = "#C2334A";

const INSIDE = [
  "Пошаговый маршрут от фотографии до получения паспорта",
  "Требования к фото и правила работы с анкетой DS-160",
  "Как создать личный кабинет, оплатить консульский сбор и записаться на собеседование",
  "Что взять с собой и как подготовиться к собеседованию",
  "Что делать после собеседования и в случае отказа",
  "Финальный чек-лист и шпаргалка на одной странице",
];

const STEPS = [
  { t: "Фото в электронном виде", d: "Цветное квадратное фото по требованиям для анкеты DS-160." },
  { t: "Анкета DS-160", d: "Заполнить на английском, подписать, отправить и распечатать Confirmation page." },
  { t: "Кабинет, сбор и запись", d: "Создать кабинет, добавить семью, оплатить сбор и выбрать дату собеседования." },
  { t: "Собеседование", d: "Прийти с распечатками и спокойно ответить на вопросы консула." },
  { t: "Паспорт и статус", d: "Отслеживать статус паспорта на сайте CEAC после одобрения." },
];

const CONTENTS = [
  "Что нужно знать о визе B1/B2",
  "Алгоритм: от начала до паспорта",
  "Какие документы понадобятся",
  "Шаг 1. Фото для анкеты",
  "Шаг 2. Анкета DS-160",
  "Шаг 3. Кабинет, консульский сбор и запись",
  "Шаг 4. Собеседование",
  "Шаг 5. После собеседования",
  "Если пришёл отказ",
  "Финальный чек-лист",
  "Шпаргалка на одной странице",
  "Сопровождение и контакты",
];

const PAGES = [
  { src: "/landing/guide-page-05.jpg", alt: "Страница гайда: алгоритм из пяти шагов" },
  { src: "/landing/guide-page-14.jpg", alt: "Страница гайда: финальный чек-лист" },
  { src: "/landing/guide-page-15.jpg", alt: "Страница гайда: шпаргалка на одной странице" },
];

const FAQ = [
  {
    q: "Гарантирует ли гайд получение визы?",
    a: "Нет. Решение о выдаче визы принимает только консульский офицер. Гайд помогает пройти процесс без ошибок: правильно подготовить фото и анкету, записаться и собраться на собеседование.",
  },
  {
    q: "В каком формате гайд и как быстро я его получу?",
    a: "PDF на 16 страниц. После оплаты бот сразу присылает файл в Telegram — его можно открыть на телефоне или компьютере и распечатать.",
  },
  {
    q: "Как оплатить?",
    a: "Нажмите «Купить» — откроется наш Telegram-бот с кнопкой оплаты. Оплата проходит через Робокассу: банковская карта или СБП. Чек придёт на почту, указанную при оплате.",
  },
  {
    q: "Насколько актуальна информация?",
    a: "Редакция — октябрь 2026 года: страны собеседования, консульский сбор, требования к фото и порядок записи. Актуальные правила и сборы всегда стоит сверять с официальными сайтами.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Если файл не пришёл по нашей вине — вернём деньги полностью. Остальные случаи описаны в публичной оферте.",
  },
  {
    q: "Мне нужна помощь, а не только инструкция",
    a: "Есть услуга полного сопровождения: стратегия кейса, анкета DS-160, оплата сбора, запись через бота, подготовка к собеседованию и отслеживание паспорта. Напишите нам в Telegram.",
  },
];

function formatPrice(p?: string) {
  if (!p) return "";
  const n = Number(p);
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })} ₽`;
}

function BuyButton({ big = false, className }: { big?: boolean; className?: string }) {
  const { data } = useSite();
  const offer = data?.offer;
  if (!offer) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/70", className)}>
        Скоро в продаже
      </span>
    );
  }
  return (
    <a
      href={offer.buy_url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-[0_10px_30px_rgba(194,51,74,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(194,51,74,0.45)]",
        big ? "px-7 py-4 text-base" : "px-4 py-2.5 text-sm",
        className,
      )}
      style={{ background: RED }}
    >
      <Send className={big ? "h-5 w-5" : "h-4 w-4"} />
      Купить гайд{offer.price ? ` за ${formatPrice(offer.price)}` : ""}
    </a>
  );
}

function SectionTitle({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div className="mb-10 max-w-2xl">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: RED }}>
        {eyebrow}
      </div>
      <h2 className={cn("text-3xl font-extrabold tracking-tight sm:text-4xl", light ? "text-white" : "text-[#0B1F3A]")}>{title}</h2>
    </div>
  );
}

export function GuideLanding() {
  const [open, setOpen] = useState<number | null>(0);
  const { data } = useSite();

  return (
    <div className="min-h-screen bg-white text-[#1d2433]">
      <SiteHeader cta={<BuyButton />} />

      {/* Первый экран */}
      <section className="relative overflow-hidden text-white" style={{ background: NAVY }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(232,80,106,0.5) 0%, transparent 60%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "#E8506A" }}>
              Пошаговый гайд · редакция октябрь 2026
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Виза США <span style={{ color: "#E8506A" }}>B1 / B2</span>
              <br />
              самостоятельно
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Как гражданину РФ оформить туристическую визу США — от фотографии до паспорта с визой. Практический
              маршрут: что сделать, в каком порядке и где легко ошибиться.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#E8506A]" /> PDF, 16 страниц</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#E8506A]" /> 12 разделов + чек-лист</li>
              <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#E8506A]" /> Сразу после оплаты в Telegram</li>
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <BuyButton big />
              <a href="#inside" className="text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline">
                Что внутри →
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <img
              src="/landing/guide-page-01.jpg"
              alt="Обложка гайда «Виза США B1/B2»"
              className="relative z-10 w-full rotate-[-3deg] rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
            />
            <img
              src="/landing/guide-page-15.jpg"
              alt=""
              aria-hidden
              className="absolute -right-8 top-10 hidden w-3/4 rotate-[6deg] rounded-xl opacity-80 shadow-2xl sm:block"
            />
          </div>
        </div>
      </section>

      {/* Цифры */}
      <section className="border-b border-black/[0.06] bg-[#F5F6FA]">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            ["185 $", "консульский сбор на турвизу B1/B2"],
            ["2 страны", "где сейчас возможно собеседование для граждан РФ"],
            ["5 шагов", "от фотографии до паспорта с визой"],
          ].map(([big, small]) => (
            <div key={big} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-2 h-1 w-8 rounded" style={{ background: RED }} />
              <div className="text-3xl font-extrabold text-[#0B1F3A]">{big}</div>
              <div className="mt-1 text-sm text-[#5b6475]">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Для кого + что внутри */}
      <section id="inside" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Для кого" title="Для тех, кто хочет оформить визу сам и боится ошибиться" />
            <p className="text-lg leading-relaxed text-[#3d4556]">
              Гайд собран как практический маршрут. Прочитайте его за 5 минут — и вы будете знать путь целиком: что
              сделать, в каком порядке, где именно и на что обратить внимание.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <img src="/landing/beverly-hills.jpg" alt="Калифорния, Беверли-Хиллз" className="h-44 w-full rounded-2xl object-cover" />
              <img src="/landing/times-square.jpg" alt="Нью-Йорк, Таймс-сквер" className="h-44 w-full rounded-2xl object-cover" />
            </div>
          </div>
          <div>
            <SectionTitle eyebrow="Что внутри" title="Всё, что нужно для подачи" />
            <ul className="space-y-4">
              {INSIDE.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: RED }}>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[17px] text-[#1d2433]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Шаги */}
      <section className="text-white" style={{ background: NAVY }}>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Алгоритм" title="Пять шагов от начала до паспорта" light />
          <div className="grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: i === STEPS.length - 1 ? RED : "rgba(255,255,255,0.12)" }}
                >
                  {i + 1}
                </div>
                <div className="font-semibold">{s.t}</div>
                <div className="mt-2 text-sm leading-relaxed text-white/60">{s.d}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-white/50">
            Порядок имеет значение: анкету DS-160 нужно подписать не позднее чем за 3 рабочих дня до собеседования, а
            свободных дат записи бывает мало — в гайде сказано, с чего начать.
          </p>
        </div>
      </section>

      {/* Содержание и превью */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionTitle eyebrow="Содержание" title="12 разделов" />
            <ol className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.06]">
              {CONTENTS.map((c, i) => (
                <li key={c} className="flex items-baseline gap-4 px-5 py-3">
                  <span className="w-6 text-sm font-bold tabular-nums" style={{ color: RED }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px]">{c}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <SectionTitle eyebrow="Как выглядит" title="Страницы гайда" />
            <div className="grid grid-cols-3 gap-3">
              {PAGES.map((p) => (
                <img key={p.src} src={p.src} alt={p.alt} className="w-full rounded-xl shadow-lg ring-1 ring-black/5" />
              ))}
            </div>
            <p className="mt-4 text-sm text-[#5b6475]">
              Таблицы требований, чек-листы, ссылки на официальные порталы и советы эксперта — на каждом шаге.
            </p>
          </div>
        </div>
      </section>

      {/* Как купить */}
      <section className="bg-[#F5F6FA]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Покупка" title="Как получить гайд" />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Send, t: "Нажмите «Купить»", d: "Откроется наш Telegram-бот с описанием гайда и кнопкой оплаты." },
              { icon: CreditCard, t: "Оплатите", d: "Через Робокассу: банковская карта или СБП. Чек придёт на почту." },
              { icon: FileText, t: "Получите PDF", d: "Бот сразу пришлёт гайд в чат — откройте на любом устройстве." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white p-6 shadow-sm">
                <Icon className="h-6 w-6" style={{ color: RED }} />
                <div className="mt-4 font-semibold text-[#0B1F3A]">{t}</div>
                <div className="mt-1 text-sm leading-relaxed text-[#5b6475]">{d}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <BuyButton big />
            <span className="flex items-center gap-1.5 text-sm text-[#5b6475]">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Безопасная оплата через Робокассу
            </span>
          </div>
        </div>
      </section>

      {/* Автор */}
      <section id="author" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 rounded-3xl bg-[#F5F6FA] p-6 sm:p-10 md:grid-cols-[280px_1fr]">
          <img src="/landing/author.jpg" alt="Ольга Игнатьева" className="mx-auto w-full max-w-[280px] rounded-2xl object-cover shadow-lg" />
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: RED }}>
              Об авторе
            </div>
            <h2 className="text-3xl font-extrabold text-[#0B1F3A]">Ольга Игнатьева</h2>
            <p className="mt-2 text-lg text-[#3d4556]">Визовый эксперт и основатель визового агентства VisaNews2U</p>
            <p className="mt-4 leading-relaxed text-[#3d4556]">
              Если хотите пройти путь без лишнего риска — есть услуга полного сопровождения: консультация по выбору
              страны собеседования, стратегия кейса, анкета DS-160, оплата сбора, запись через бота, подготовка к
              собеседованию и отслеживание паспорта.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a href={CONTACTS.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 font-medium text-white hover:opacity-90">
                <Send className="h-4 w-4" /> Написать в Telegram
              </a>
              <a href={CONTACTS.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 font-medium text-[#0B1F3A] hover:bg-black/[0.02]">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href={CONTACTS.channel} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-black/10 bg-white px-4 py-2.5 font-medium text-[#0B1F3A] hover:bg-black/[0.02]">
                Telegram-канал
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <SectionTitle eyebrow="Вопросы" title="Частые вопросы" />
        <div className="divide-y divide-black/[0.07] rounded-2xl border border-black/[0.07]">
          {FAQ.map((f, i) => (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-[#0B1F3A]"
                aria-expanded={open === i}
              >
                {f.q}
                <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open === i && "rotate-180")} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-[15px] leading-relaxed text-[#3d4556]">
                  {f.a}
                  {i === 4 && (
                    <>
                      {" "}
                      <Link href="/offer" className="underline" style={{ color: RED }}>
                        Читать оферту
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="relative overflow-hidden text-white" style={{ background: NAVY }}>
        <img src="/landing/route66.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Начните путь к визе США сегодня</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Пошаговый маршрут, чек-лист и шпаргалка — в одном PDF. Гайд придёт в Telegram сразу после оплаты.
          </p>
          <div className="mt-8 flex justify-center">
            <BuyButton big />
          </div>
          {data?.offer && (
            <p className="mt-4 text-xs text-white/50">
              Нажимая «Купить», вы принимаете условия{" "}
              <Link href="/offer" className="underline">оферты</Link> и{" "}
              <Link href="/privacy" className="underline">политики конфиденциальности</Link>.
            </p>
          )}
        </div>
      </section>

      <div className="bg-[#F5F6FA]">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-[#7a8294] sm:px-6">
          Гайд носит информационный характер и не является официальным документом посольства или консульства США.
          Решение о выдаче визы принимает консульский офицер; результат гарантировать невозможно. Актуальные правила и
          сборы проверяйте на официальных сайтах.
        </p>
      </div>

      <SiteFooter />
    </div>
  );
}
