"use client";

import { useState } from "react";

import { botsApi } from "@/api/bots";
import { cn } from "@/lib/utils";

interface BotAvatarProps {
  botId: string;
  name: string;
  size?: number;
  className?: string;
}

/** Аватар бота из Telegram; если фото нет — первая буква на фирменном градиенте. */
export function BotAvatar({ botId, name, size = 44, className }: BotAvatarProps) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#069DDF] to-[#2B2E81] font-semibold text-white",
          className,
        )}
        style={style}
        aria-hidden
      >
        {name.trim().charAt(0).toUpperCase() || "B"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={botsApi.avatarUrl(botId)}
      alt=""
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={style}
    />
  );
}
