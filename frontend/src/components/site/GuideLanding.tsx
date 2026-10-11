"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";
import { CONTACTS, SiteFooter, SiteHeader } from "./SiteShell";
import { C, SERIF } from "./theme";
import { useSite } from "./useSite";

const INSIDE = [
  { t: "Маршрут целиком", d: "Пошаговый путь от фотографии до паспорта с визой" },
  { t: "Фото и анкета DS-160", d: "Требования к фото и правила заполнения анкеты" },
  { t: "Кабинет и запись", d: "Оплата консульского сбора и выбор даты собеседования" },
  { t: "Собеседование", d: "Что взять с собой и как подготовиться к вопросам" },
  { t: "После собеседования", d: "Статус паспорта и что делать, если пришёл отказ" },
  { t: "Чек-лист и шпаргалка", d: "Всё самое важное — на одной странице" },
];

const STEPS = [
  { t: "Фото", d: "Цветное квадратное фото по требованиям анкеты DS-160." },
  { t: "Анкета DS-160", d: "Заполнить на английском, подписать, отправить, распечатать подтверждение." },
  { t: "Кабинет и запись", d: "Создать кабинет, добавить семью, оплатить сбор и выбрать дату." },
  { t: "Собеседование", d: "Прийти с распечатками и спокойно ответить на вопросы консула." },
  { t: "Паспорт", d: "Отслеживать статус паспорта на сайте CEAC после одобрения." },
];

const CONTENTS = [
  "Что нужно знать о визе B1/B2",
  "Алгоритм: от начала до паспорта",
  "Какие документы понадобятся",
  "Фото для анкеты",
  "Анкета DS-160",
  "Кабинет, консульский сбор и запись",
  "Собеседование",
  "После собеседования",
  "Если пришёл отказ",
  "Финальный чек-лист",
  "Шпаргалка на одной странице",
  "Сопровождение и контакты",
];

const FAQ = [
  {
    q: "Гарантирует ли гайд получение визы?",
    a: "Нет. Решение о выдаче визы принимает только консульский офицер. Гайд помогает пройти процесс без ошибок: правильно подготовить фото и анкету, записаться и собраться на собеседование.",
  },
  {
    q: "В каком формате гайд и как быстро он придёт?",
    a: "PDF на 16 страниц. После оплаты бот сразу присылает файл в Telegram — его можно открыть на телефоне или компьютере и распечатать.",
  },
  {
    q: "Как проходит оплата?",
    a: "Кнопка «Купить» открывает наш Telegram-бот с карточкой гайда. Оплата — через Робокассу, банковской картой или по СБП. Чек приходит на почту, указанную при оплате.",
  },
  {
    q: "Насколько актуальна информация?",
    a: "Редакция — октябрь 2026 года: страны собеседования, консульский сбор, требования к фото и порядок записи. Правила меняются, поэтому сверяйтесь с официальными сайтами — ссылки на них есть в гайде.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Если файл не пришёл по нашей вине — вернём полностью. Остальные случаи описаны в публичной оферте.",
    offer: true,
  },
  {
    q: "Нужна помощь, а не только инструкция",
    a: "Есть полное сопровождение: стратегия кейса, анкета DS-160, оплата сбора, запись через бота, подготовка к собеседованию и отслеживание паспорта. Напишите нам в Telegram.",
  },
];

function price(p?: string) {
  if (!p) return "";
  const n = Number(p);
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })} ₽`;
}

function BuyButton({ size = "md", onDark = false, className }: { size?: "md" | "lg"; onDark?: boolean; className?: string }) {
  const { data, isLoading } = useSite();
  const offer = data?.offer;
  const base = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-200",
    size === "lg" ? "h-12 px-7 text-[15px]" : "h-10 px-4 text-[13px] sm:px-5 sm:text-[14px]",
    className,
  );
  if (isLoading) return <span className={cn(base, "invisible")}>Купить</span>;
  if (!offer) {
    return (
      <span
        className={cn(base, "cursor-default border", onDark ? "border-white/20 text-white/60" : "border-[#E5E8EE] text-[#64748B]")}
      >
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
        base,
        onDark ? "bg-white text-[#0F1B2D] hover:bg-white/90" : "bg-[#2B2E81] text-white hover:bg-[#22256B]",
      )}
    >
      Купить за {price(offer.price)}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <div
      className="mb-4 text-[12px] font-medium uppercase tracking-[0.16em]"
      style={{ color: onDark ? "rgba(255,255,255,0.5)" : C.accent }}
    >
      {children}
    </div>
  );
}

function H2({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <h2
      className="text-[34px] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[44px]"
      style={{ color: onDark ? "#fff" : C.ink, fontFamily: SERIF }}
    >
      {children}
    </h2>
  );
}

function FaqItem({ item, open, onToggle }: { item: (typeof FAQ)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.line}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className="text-[17px] font-medium" style={{ color: C.ink }}>
          {item.q}
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors"
          style={{ borderColor: C.line, color: C.ink }}
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-6 text-[15px] leading-relaxed" style={{ color: C.text }}>
            {item.a}
            {item.offer && (
              <>
                {" "}
                <Link href="/offer" className="underline underline-offset-4" style={{ color: C.primary }}>
                  Открыть оферту
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GuideLanding() {
  const [open, setOpen] = useState<number | null>(0);
  const { data } = useSite();

  return (
    <div className="min-h-screen bg-white" style={{ color: C.text }}>
      <SiteHeader cta={<BuyButton />} />

      {/* Первый экран */}
      <section className="relative overflow-hidden text-white" style={{ background: C.ink }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 -top-48 h-[720px] w-[720px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(43,46,129,0.55) 0%, transparent 62%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-16 sm:px-8 md:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <Eyebrow onDark>Пошаговый гайд · редакция октябрь 2026</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1
                className="text-[46px] font-medium leading-[1.02] tracking-[-0.015em] sm:text-[64px] lg:text-[72px]"
                style={{ fontFamily: SERIF }}
              >
                Виза США B1/B2
                <br />
                <em className="font-normal" style={{ color: "rgba(255,255,255,0.62)" }}>
                  самостоятельно
                </em>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-[18px] leading-relaxed" style={{ color: C.onDarkMuted }}>
                Как гражданину РФ оформить туристическую визу США — от фотографии до паспорта с визой. Практический
                маршрут: что сделать, в каком порядке и где легко ошибиться.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
                <BuyButton size="lg" onDark />
                <a href="#inside" className="text-[15px] text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
                  Что внутри
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <dl
                className="mt-14 grid max-w-lg grid-cols-3 gap-6 pt-6 text-[13px]"
                style={{ borderTop: `1px solid ${C.onDarkLine}` }}
              >
                {[
                  ["Формат", "PDF, 16 стр."],
                  ["Разделов", "12 + чек-лист"],
                  ["Доставка", "Сразу в Telegram"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-white/45">{k}</dt>
                    <dd className="mt-1 text-[15px] text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
          <Reveal delay={200} distance={48}>
            <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px]">
              <img
                src="/landing/guide-page-15.jpg"
                alt=""
                aria-hidden
                className="absolute -right-10 top-12 hidden w-[78%] rotate-[6deg] rounded-lg opacity-90 shadow-[0_30px_60px_rgba(0,0,0,0.45)] sm:block"
              />
              <img
                src="/landing/guide-page-01.jpg"
                alt="Обложка гайда «Виза США B1/B2»"
                className="relative w-full -rotate-[3deg] rounded-lg shadow-[0_40px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Цифры */}
      <section style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto grid max-w-6xl sm:grid-cols-3">
          {[
            ["185 $", "консульский сбор на турвизу B1/B2"],
            ["2 страны", "где сейчас возможно собеседование для граждан РФ"],
            ["5 шагов", "от фотографии до паспорта с визой"],
          ].map(([big, small], i) => (
            <Reveal
              key={big}
              delay={i * 90}
              className={cn("px-5 py-10 sm:px-8", i > 0 && "sm:border-l")}
              style={{ borderColor: C.line }}
            >
              <div className="text-[44px] font-medium leading-none" style={{ color: C.ink, fontFamily: SERIF }}>{big}</div>
              <div className="mt-3 text-[14px]" style={{ color: C.muted }}>{small}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Для кого и что внутри */}
      <section id="inside" className="mx-auto grid max-w-6xl scroll-mt-20 gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2">
        <div>
          <Reveal><Eyebrow>Для кого</Eyebrow></Reveal>
          <Reveal delay={80}><H2>Для тех, кто хочет оформить визу сам — и боится ошибиться</H2></Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed">
              Гайд собран как практический маршрут. Пять минут — и вы видите путь целиком: что сделать, в каком порядке,
              где именно и на что обратить внимание.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              ["/landing/beverly-hills.jpg", "Калифорния, Беверли-Хиллз"],
              ["/landing/times-square.jpg", "Нью-Йорк, Таймс-сквер"],
            ].map(([src, alt], i) => (
              <Reveal key={src} delay={200 + i * 100} distance={36}>
                <img src={src} alt={alt} className="h-56 w-full rounded-2xl object-cover sm:h-64" />
              </Reveal>
            ))}
          </div>
        </div>
        <div>
          <Reveal><Eyebrow>Что внутри</Eyebrow></Reveal>
          <ol style={{ borderTop: `1px solid ${C.line}` }}>
            {INSIDE.map((item, i) => (
              <Reveal
                as="li"
                key={item.t}
                delay={i * 70}
                className="grid grid-cols-[52px_1fr] items-baseline py-5"
                style={{ borderBottom: `1px solid ${C.line}` }}
              >
                <span className="text-[22px] italic leading-none" style={{ color: C.accent, fontFamily: SERIF }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="text-[17px] font-medium" style={{ color: C.ink }}>{item.t}</div>
                  <div className="mt-1 text-[15px]" style={{ color: C.muted }}>{item.d}</div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Шаги */}
      <section id="steps" className="scroll-mt-16" style={{ background: C.ink }}>
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal><Eyebrow onDark>Алгоритм</Eyebrow></Reveal>
          <Reveal delay={80}><H2 onDark>Пять шагов от начала до паспорта</H2></Reveal>
          <ol className="mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 90} className="relative">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[17px] italic text-white"
                    style={{ fontFamily: SERIF,  borderColor: i === STEPS.length - 1 ? C.accent : C.onDarkLine, background: i === STEPS.length - 1 ? C.accent : "transparent" }}
                  >
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span className="hidden h-px flex-1 md:block" style={{ background: C.onDarkLine }} />}
                </div>
                <div className="mt-6 text-[17px] font-medium text-white">{s.t}</div>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: C.onDarkMuted }}>{s.d}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={200}>
            <p className="mt-14 max-w-2xl text-[14px] leading-relaxed" style={{ color: C.onDarkMuted }}>
              Порядок имеет значение: анкету DS-160 нужно подписать не позднее чем за 3 рабочих дня до собеседования, а
              свободных дат записи бывает мало. В гайде — с чего начать, чтобы не потерять время.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Фотолента */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          {[
            ["/landing/liberty.jpg", "Нью-Йорк, статуя Свободы"],
            ["/landing/hollywood.jpg", "Лос-Анджелес, Голливуд"],
          ].map(([src, alt], i) => (
            <Reveal as="figure" key={src} delay={i * 120} distance={40}>
              <img src={src} alt={alt} className="h-72 w-full rounded-[24px] object-cover sm:h-96" />
              <figcaption className="mt-3 text-[13px]" style={{ color: C.muted }}>{alt}</figcaption>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Содержание и страницы */}
      <section className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <Reveal><Eyebrow>Содержание</Eyebrow></Reveal>
          <Reveal delay={80}><H2>12 разделов</H2></Reveal>
          <ol className="mt-10" style={{ borderTop: `1px solid ${C.line}` }}>
            {CONTENTS.map((c, i) => (
              <Reveal
                as="li"
                key={c}
                delay={(i % 6) * 50}
                distance={16}
                className="grid grid-cols-[44px_1fr] items-baseline py-3.5"
                style={{ borderBottom: `1px solid ${C.line}` }}
              >
                <span className="text-[17px] italic" style={{ color: C.muted, fontFamily: SERIF }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[16px]" style={{ color: C.ink }}>{c}</span>
              </Reveal>
            ))}
          </ol>
        </div>
        <div>
          <Reveal><Eyebrow>Как выглядит</Eyebrow></Reveal>
          <Reveal delay={80}><H2>Страницы гайда</H2></Reveal>
          <Reveal delay={160} distance={40}>
            <div className="mt-10 grid grid-cols-3 gap-4 rounded-[28px] p-6 sm:p-8" style={{ background: C.surface }}>
              {[
                ["/landing/guide-page-05.jpg", "Алгоритм из пяти шагов"],
                ["/landing/guide-page-14.jpg", "Финальный чек-лист"],
                ["/landing/guide-page-15.jpg", "Шпаргалка на одной странице"],
              ].map(([src, alt]) => (
                <figure key={src}>
                  <img src={src} alt={alt} className="w-full rounded-md shadow-[0_12px_28px_-10px_rgba(15,27,45,0.3)]" />
                  <figcaption className="mt-3 text-[12px] leading-snug" style={{ color: C.muted }}>{alt}</figcaption>
                </figure>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 text-[15px] leading-relaxed">
              Таблицы требований, чек-листы, ссылки на официальные порталы и советы эксперта — на каждом шаге.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Как купить */}
      <section style={{ background: C.surface }}>
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal><Eyebrow>Покупка</Eyebrow></Reveal>
          <Reveal delay={80}><H2>Как получить гайд</H2></Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl md:grid-cols-3" style={{ background: C.line }}>
            {[
              ["Нажмите «Купить»", "Откроется наш Telegram-бот с описанием гайда и кнопкой оплаты."],
              ["Оплатите", "Через Робокассу — банковской картой или по СБП. Чек придёт на почту."],
              ["Получите PDF", "Бот сразу пришлёт гайд в чат. Открывается на любом устройстве."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 90} className="bg-white p-8">
                <div className="text-[28px] italic leading-none" style={{ color: C.accent, fontFamily: SERIF }}>0{i + 1}</div>
                <div className="mt-6 text-[18px] font-medium" style={{ color: C.ink }}>{t}</div>
                <p className="mt-2 text-[15px] leading-relaxed">{d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <BuyButton size="lg" />
              <span className="text-[14px]" style={{ color: C.muted }}>Безопасная оплата через Робокассу</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Автор */}
      <section id="author" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-5 py-24 sm:px-8 md:grid-cols-[320px_1fr] md:gap-16">
        <Reveal distance={40}>
          <img src="/landing/author.jpg" alt="Ольга Игнатьева" className="mx-auto w-full max-w-[320px] rounded-[24px] object-cover" />
        </Reveal>
        <div>
          <Reveal><Eyebrow>Об авторе</Eyebrow></Reveal>
          <Reveal delay={80}><H2>Ольга Игнатьева</H2></Reveal>
          <Reveal delay={140}>
            <p className="mt-3 text-[18px]" style={{ color: C.muted }}>Визовый эксперт, основатель агентства VisaNews2U</p>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed">
              Если хотите пройти путь без лишнего риска — есть полное сопровождение: выбор страны собеседования,
              стратегия кейса, анкета DS-160, оплата сбора, запись через бота, подготовка к собеседованию и отслеживание
              паспорта.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-8 flex flex-wrap gap-3 text-[14px] font-medium">
              {[
                ["Написать в Telegram", CONTACTS.telegram],
                ["WhatsApp", CONTACTS.whatsapp],
                ["Telegram-канал", CONTACTS.channel],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center rounded-full border px-5 transition-colors hover:bg-[#F5F7FA]"
                  style={{ borderColor: C.line, color: C.ink }}
                >
                  {label}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Reveal><Eyebrow>Вопросы</Eyebrow></Reveal>
            <Reveal delay={80}><H2>Частые вопросы</H2></Reveal>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60} distance={16}>
                <FaqItem item={f} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Финальный призыв — того же цвета, что подвал */}
      <section className="relative overflow-hidden" style={{ background: C.ink }}>
        <img src="/landing/route66.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(15,27,45,0.55) 0%, rgba(15,27,45,0.88) 60%, #0F1B2D 100%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-6 pt-32 sm:px-8">
          <div className="grid items-end gap-10 md:grid-cols-[1.4fr_1fr]">
            <div>
              <Reveal><H2 onDark>Начните путь к визе США сегодня</H2></Reveal>
              <Reveal delay={100}>
                <p className="mt-5 max-w-lg text-[16px] leading-relaxed" style={{ color: C.onDarkMuted }}>
                  Маршрут, чек-лист и шпаргалка — в одном PDF. Гайд придёт в Telegram сразу после оплаты.
                </p>
              </Reveal>
            </div>
            <Reveal delay={180} className="md:text-right">
              <BuyButton size="lg" onDark />
              {data?.offer && (
                <p className="mt-4 text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Нажимая «Купить», вы принимаете{" "}
                  <Link href="/offer" className="underline underline-offset-2">оферту</Link> и{" "}
                  <Link href="/privacy" className="underline underline-offset-2">политику конфиденциальности</Link>
                </p>
              )}
            </Reveal>
          </div>
          <p
            className="mt-20 pt-6 text-[12px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.4)", borderTop: `1px solid ${C.onDarkLine}` }}
          >
            Гайд носит информационный характер и не является официальным документом посольства или консульства США.
            Решение о выдаче визы принимает консульский офицер; результат гарантировать невозможно. Актуальные правила и
            сборы проверяйте на официальных сайтах.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
