"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";

import { botsApi } from "@/api/bots";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import type { Bot } from "@/types";

/** Telegram допускает в start-параметре только A-Z a-z 0-9 _ - (до 64 символов). */
function toLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

const SUGGESTIONS = ["instagram", "reels", "youtube", "stories", "channel"];

export function SourceLinks({ bot }: { bot: Bot }) {
  const [label, setLabel] = useState("");
  const base = `https://t.me/${bot.username}`;
  const link = label ? `${base}?start=${label}` : base;

  const { data: sources = [] } = useQuery({
    queryKey: ["bot-sources", bot.id],
    queryFn: () => botsApi.sources(bot.id),
  });
  const total = sources.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm text-[#636366]">
          Добавьте метку к ссылке на бота, и вы увидите, откуда пришёл каждый подписчик.
          Например, отдельная ссылка для Reels и для сторис.
        </p>
        <div className="space-y-2">
          <label htmlFor="source-label" className="text-sm font-medium">
            Метка (латиницей)
          </label>
          <Input
            id="source-label"
            placeholder="instagram"
            value={label}
            onChange={(e) => setLabel(toLabel(e.target.value))}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLabel(s)}
                className="rounded-full border border-black/[0.08] px-2.5 py-1 text-xs text-[#636366] transition hover:border-[#069DDF] hover:text-[#2B2E81]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(6,157,223,0.25)] bg-[rgba(6,157,223,0.05)] px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-[#069DDF]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[#2B2E81]">{link}</span>
          <CopyButton value={link} message="Ссылка скопирована" />
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-medium">Откуда приходят подписчики</div>
        {sources.length === 0 ? (
          <p className="rounded-xl bg-black/[0.03] p-4 text-sm text-[#8e8e93]">
            Пока нет подписчиков. Отправьте ссылку и нажмите в боте «Старт», чтобы проверить.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sources.map((s) => {
              const pct = total ? Math.round((s.count / total) * 100) : 0;
              return (
                <li key={s.source ?? "_direct"} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 font-medium">
                      {s.source ?? <span className="text-[#8e8e93]">без метки</span>}
                      {s.source && (
                        <CopyButton value={`${base}?start=${s.source}`} message="Ссылка скопирована" />
                      )}
                    </span>
                    <span className="tabular-nums text-[#636366]">
                      {s.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#069DDF] to-[#2B2E81]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
