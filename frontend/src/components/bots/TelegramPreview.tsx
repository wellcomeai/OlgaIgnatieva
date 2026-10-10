"use client";

import type { WelcomeButton } from "@/types";
import { BotAvatar } from "./BotAvatar";

const SAMPLE = { first_name: "Ольга", username: "@olga" };

/**
 * Безопасный рендер подмножества Telegram-HTML: сначала экранируем всё,
 * потом возвращаем только разрешённые теги без атрибутов (и <a> с http-ссылкой).
 */
function renderTelegramHtml(text: string): string {
  const withValues = text
    .replaceAll("{first_name}", SAMPLE.first_name)
    .replaceAll("{username}", SAMPLE.username);
  return withValues
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/&lt;(\/?)(b|strong|i|em|u|s|code)&gt;/g, "<$1$2>")
    .replace(
      /&lt;a href=&quot;(https?:\/\/[^\s&]+)&quot;&gt;/g,
      '<a href="$1" target="_blank" rel="noreferrer">',
    )
    .replace(/&lt;\/a&gt;/g, "</a>");
}

function time(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

interface TelegramPreviewProps {
  botId: string;
  botName: string;
  text: string;
  buttons: WelcomeButton[];
  /** Подписи кнопок «Купить» (callback-кнопки — без значка ссылки). */
  productButtons?: string[];
}

export function TelegramPreview({ botId, botName, text, buttons, productButtons = [] }: TelegramPreviewProps) {
  const now = time();
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-[#1c1c1e] bg-[#1c1c1e] shadow-[0_20px_60px_rgba(43,46,129,0.18)]">
      {/* шапка чата */}
      <div className="flex items-center gap-2.5 bg-white px-3 py-2.5">
        <BotAvatar botId={botId} name={botName} size={34} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-[#171717]">{botName}</div>
          <div className="text-[11px] text-[#8e8e93]">бот</div>
        </div>
      </div>

      {/* лента */}
      <div
        className="flex min-h-[380px] flex-col gap-2 px-3 py-4"
        style={{
          background:
            "linear-gradient(160deg, #cfe3ef 0%, #dbe9d4 50%, #e9e3c9 100%)",
        }}
      >
        <div className="self-end rounded-2xl rounded-br-md bg-[#effdde] px-3 py-1.5 text-[14px] text-[#171717] shadow-sm">
          /start
          <span className="ml-2 align-bottom text-[10px] text-[#5eae4c]">{now} ✓✓</span>
        </div>

        <div className="max-w-[88%] self-start">
          <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[14px] leading-[1.4] text-[#171717] shadow-sm">
            {text.trim() ? (
              <div
                className="whitespace-pre-wrap break-words [&_a]:text-[#168acd] [&_a]:underline [&_code]:rounded [&_code]:bg-black/[0.05] [&_code]:px-1"
                dangerouslySetInnerHTML={{ __html: renderTelegramHtml(text) }}
              />
            ) : (
              <span className="italic text-[#8e8e93]">Текст приветствия…</span>
            )}
            <div className="mt-0.5 text-right text-[10px] text-[#8e8e93]">{now}</div>
          </div>
          {buttons.length + productButtons.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {productButtons.map((label, i) => (
                <div
                  key={`p${i}`}
                  className="truncate rounded-xl bg-black/[0.18] px-3 py-2 text-center text-[13px] font-medium text-white backdrop-blur"
                >
                  {label}
                </div>
              ))}
              {buttons.map((b, i) => (
                <div
                  key={i}
                  className="truncate rounded-xl bg-black/[0.18] px-3 py-2 text-center text-[13px] font-medium text-white backdrop-blur"
                >
                  {b.text || "Кнопка"} <span className="opacity-70">↗</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
