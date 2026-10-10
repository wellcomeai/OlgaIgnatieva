"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { botsApi } from "@/api/bots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/errors";
import type { Bot, WelcomeButton } from "@/types";
import { TelegramPreview } from "./TelegramPreview";

const MAX_TEXT = 4096;
const MAX_BUTTONS = 8;
const URL_RE = /^(https?|tg):\/\/\S+$/;

const PLACEHOLDERS = [
  { token: "{first_name}", label: "Имя" },
  { token: "{username}", label: "@ник" },
];

export function WelcomeEditor({ bot }: { bot: Bot }) {
  const qc = useQueryClient();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(bot.welcome_text);
  const [buttons, setButtons] = useState<WelcomeButton[]>(bot.welcome_buttons);

  useEffect(() => {
    setText(bot.welcome_text);
    setButtons(bot.welcome_buttons);
  }, [bot.welcome_text, bot.welcome_buttons]);

  const dirty =
    text !== bot.welcome_text || JSON.stringify(buttons) !== JSON.stringify(bot.welcome_buttons);
  const buttonErrors = buttons.map((b) =>
    !b.text.trim() ? "Введите текст" : !URL_RE.test(b.url.trim()) ? "Ссылка должна начинаться с https://" : null,
  );
  const valid = text.trim().length > 0 && text.length <= MAX_TEXT && buttonErrors.every((e) => !e);

  const save = useMutation({
    mutationFn: () =>
      botsApi.update(bot.id, {
        welcome_text: text,
        welcome_buttons: buttons.map((b) => ({ text: b.text.trim(), url: b.url.trim() })),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["bot", bot.id], updated);
      toast.success("Приветствие сохранено");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось сохранить")),
  });

  /** Обернуть выделение в теги или вставить текст в позицию курсора. */
  function insert(before: string, after = "") {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = text.slice(0, s) + before + text.slice(s, e) + after + text.slice(e);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  function updateButton(i: number, patch: Partial<WelcomeButton>) {
    setButtons((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <Label htmlFor="welcome-text">Сообщение на /start</Label>
            <span className={text.length > MAX_TEXT ? "text-xs text-red-600" : "text-xs text-[#8e8e93]"}>
              {text.length} / {MAX_TEXT}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton label="Жирный" onClick={() => insert("<b>", "</b>")}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Курсив" onClick={() => insert("<i>", "</i>")}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Ссылка" onClick={() => insert('<a href="https://">', "</a>")}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span className="mx-1 h-4 w-px bg-black/10" />
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insert(p.token)}
                className="rounded-full bg-[rgba(6,157,223,0.1)] px-2.5 py-1 text-xs font-medium text-[#2B2E81] transition hover:bg-[rgba(6,157,223,0.18)]"
              >
                + {p.label}
              </button>
            ))}
          </div>
          <Textarea
            id="welcome-text"
            ref={textRef}
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="resize-y text-[14px] leading-relaxed"
          />
          <p className="text-xs text-[#8e8e93]">
            {"{first_name}"} заменится на имя подписчика. Выделите текст и нажмите «Жирный»,
            чтобы выделить его.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Кнопки-ссылки</Label>
            <span className="text-xs text-[#8e8e93]">
              {buttons.length} / {MAX_BUTTONS}
            </span>
          </div>
          {buttons.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
                <Input
                  placeholder="Текст кнопки"
                  value={b.text}
                  maxLength={64}
                  onChange={(e) => updateButton(i, { text: e.target.value })}
                />
                <div>
                  <Input
                    placeholder="https://t.me/visanews2u"
                    value={b.url}
                    onChange={(e) => updateButton(i, { url: e.target.value })}
                  />
                  {buttonErrors[i] && (b.text || b.url) && (
                    <p className="mt-1 text-xs text-red-600">{buttonErrors[i]}</p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Удалить кнопку"
                onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-[#8e8e93]" />
              </Button>
            </div>
          ))}
          {buttons.length < MAX_BUTTONS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setButtons((bs) => [...bs, { text: "", url: "" }])}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Добавить кнопку
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-black/[0.06] pt-5">
          <Button onClick={() => save.mutate()} disabled={!dirty || !valid || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setText(bot.welcome_text);
                setButtons(bot.welcome_buttons);
              }}
            >
              Отменить
            </Button>
          )}
          {!dirty && <span className="text-xs text-[#8e8e93]">Все изменения сохранены</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-[#8e8e93]">
          Так увидит подписчик
        </div>
        <TelegramPreview botId={bot.id} botName={bot.first_name} text={text} buttons={buttons} />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[#3a3a3c] transition hover:bg-black/[0.06]"
    >
      {children}
    </button>
  );
}
