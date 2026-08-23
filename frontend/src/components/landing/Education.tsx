"use client";

import Link from "next/link";
import { Github, GraduationCap, Send } from "lucide-react";
import { motion } from "framer-motion";

const freeItems = [
  "Весь исходный код платформы",
  "Документация: деплой, архитектура, модули",
  "CLAUDE.md для работы с AI-агентами",
  "Лицензия MIT — коммерческое использование без ограничений",
  "Разворачиваешь и дорабатываешь своими силами",
];

const eduItems = [
  "5 видеоуроков: от локального запуска до продакшена",
  "Как устроена архитектура и как её дорабатывать",
  "Добавляем свои модули и строим новые SaaS-платформы на этой базе",
  "Настройка под свой бренд и подключение оплаты",
  "Поддержка автора: разборы вопросов в Telegram",
];

export function EducationSection() {
  return (
    <section
      id="education"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        padding: "120px 0",
        marginTop: "-1px",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-120px",
          left: "-140px",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background: "rgba(139,92,246,0.06)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-180px",
          right: "-160px",
          width: "380px",
          height: "380px",
          borderRadius: "50%",
          background: "rgba(0,102,255,0.05)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <div className="text-center" style={{ marginBottom: "56px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#0066FF",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            06 / ОБУЧЕНИЕ
          </div>
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: "1.05",
              color: "#171717",
              marginBottom: "16px",
            }}
          >
            Шаблон — бесплатно.
            <br />
            Мастерство — на обучении
          </h2>
          <p
            style={{
              fontSize: "18px",
              color: "#616161",
              lineHeight: "1.6",
              maxWidth: "620px",
              margin: "0 auto",
            }}
          >
            Ты и сам справишься — код открыт. Но если ты новичок или хочешь расти
            быстрее, мы научим дорабатывать эту платформу и строить свои.
          </p>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Free card */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: "36px", display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "rgba(0,102,255,0.08)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Github size={24} color="#0066FF" strokeWidth={1.75} />
            </div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#171717",
                letterSpacing: "-0.015em",
                marginBottom: "6px",
              }}
            >
              Открытый шаблон
            </h3>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: "#171717",
                letterSpacing: "-0.02em",
                marginBottom: "20px",
              }}
            >
              0 ₽
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 28px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: 1,
              }}
            >
              {freeItems.map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: "15px",
                    color: "#3a3a3a",
                    lineHeight: "1.5",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <span style={{ color: "#0066FF", fontWeight: 700 }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="https://github.com/wellcomeai/OpenSaas--"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary-new"
              style={{ alignSelf: "flex-start" }}
            >
              <Github size={15} />
              Форкнуть на GitHub
            </Link>
            <p style={{ fontSize: "13px", color: "#9e9ea8", margin: "14px 0 0" }}>
              Если ты разработчик — этого хватит для старта.
            </p>
          </motion.div>

          {/* Education card */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: "36px",
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(139,92,246,0.35)",
              boxShadow: "0 12px 48px rgba(139,92,246,0.12)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#8b5cf6",
                background: "rgba(139,92,246,0.1)",
                borderRadius: "999px",
                padding: "4px 10px",
              }}
            >
              Для тех, кто хочет большего
            </div>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "rgba(139,92,246,0.1)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <GraduationCap size={24} color="#8b5cf6" strokeWidth={1.75} />
            </div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#171717",
                letterSpacing: "-0.015em",
                marginBottom: "6px",
              }}
            >
              Обучение
            </h3>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: "#171717",
                letterSpacing: "-0.02em",
                marginBottom: "20px",
              }}
            >
              3000 ₽{" "}
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#9e9ea8" }}>
                · разово, доступ навсегда
              </span>
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 28px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: 1,
              }}
            >
              {eduItems.map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: "15px",
                    color: "#3a3a3a",
                    lineHeight: "1.5",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <span style={{ color: "#8b5cf6", fontWeight: 700 }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {/* TODO: подключить оплату через Робокассу — пока заглушка */}
              <Link href="#education" className="btn-primary-new">
                <span aria-hidden>🎓</span>
                Купить обучение — 3000₽
              </Link>
              <Link
                href="https://t.me/wellcome_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-new"
              >
                <Send size={15} />
                Написать в Telegram
              </Link>
            </div>
            <p style={{ fontSize: "13px", color: "#9e9ea8", margin: "14px 0 0" }}>
              Онлайн-оплата скоро появится — пока пишите в Telegram, всё расскажем.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
