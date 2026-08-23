"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Это правда бесплатно?",
    a: "Да. Весь исходный код открыт на GitHub под лицензией MIT — форкайте, клонируйте, запускайте. Платное здесь только обучение, и оно опционально.",
  },
  {
    q: "Что входит в шаблон?",
    a: "Аутентификация, биллинг (Робокасса), реферальная программа, API-ключи, in-app уведомления, админка, демо-модуль. Backend на FastAPI, frontend на Next.js 14.",
  },
  {
    q: "Что даёт обучение?",
    a: "5 видеоуроков: локальный запуск, деплой на сервер, подключение оплаты, настройка под свой бренд и доработка с помощью AI. Плюс разбор архитектуры — чтобы строить на этой базе собственные SaaS-платформы, и поддержка автора.",
  },
  {
    q: "Как купить обучение?",
    a: "Пока — напишите в Telegram (@wellcome_ai), стоимость 3000₽ разово, доступ навсегда. Онлайн-оплата прямо на сайте скоро появится.",
  },
  {
    q: "Можно ли подключить Stripe?",
    a: "В шаблоне есть заготовка stripe.py с TODO и точками подключения в webhook. Документация Stripe + аналогичный код Робокассы — и Stripe заработает.",
  },
  {
    q: "Redis обязателен?",
    a: "Нет. Если REDIS_URL не задан, rate limit использует PostgreSQL fallback. Никаких других зависимостей от Redis нет.",
  },
  {
    q: "Какая лицензия?",
    a: "MIT. Используйте в коммерческих и личных проектах без ограничений.",
  },
  {
    q: "Как добавить свой модуль?",
    a: "Создайте папку backend/modules/<name>/ с моделью, схемой и сервисом, добавьте миграцию Alembic и роутер. Каждый модуль изолирован — можно писать с помощью AI-агентов.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'white',
        padding: '120px 0',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-100px',
          right: '-120px',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'rgba(139,92,246,0.05)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: '1.05',
              color: '#171717',
              marginBottom: '16px',
            }}
          >
            Частые вопросы
          </h2>
          <p
            style={{
              fontSize: '18px',
              color: '#616161',
              lineHeight: '1.6',
            }}
          >
            Если ответа нет — пишите в GitHub Issues
          </p>
        </div>

        {/* Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                style={{
                  background: isOpen ? '#fafafa' : 'white',
                  border: isOpen ? '1px solid rgba(0,102,255,0.15)' : '1px solid rgba(0,0,0,0.07)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease, background 0.2s ease',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '20px 24px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#171717',
                      letterSpacing: '-0.01em',
                      lineHeight: '1.4',
                    }}
                  >
                    {f.q}
                  </span>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: isOpen ? '#0066FF' : 'rgba(0,0,0,0.06)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {isOpen
                      ? <Minus size={14} color="white" strokeWidth={2.5} />
                      : <Plus size={14} color="#616161" strokeWidth={2.5} />
                    }
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 24px 20px',
                      fontSize: '15px',
                      color: '#616161',
                      lineHeight: '1.65',
                      borderTop: '1px solid rgba(0,0,0,0.05)',
                      paddingTop: '16px',
                    }}
                  >
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
