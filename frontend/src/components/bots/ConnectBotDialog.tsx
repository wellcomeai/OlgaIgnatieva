"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { botsApi } from "@/api/bots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/errors";

const STEPS = [
  <>
    Откройте{" "}
    <a
      href="https://t.me/BotFather"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 font-semibold text-[#2B2E81] hover:underline"
    >
      @BotFather <ExternalLink className="h-3 w-3" />
    </a>{" "}
    в Telegram
  </>,
  <>
    Отправьте команду <code className="rounded bg-black/[0.05] px-1.5 py-0.5">/newbot</code>,
    придумайте имя и адрес бота
  </>,
  <>Скопируйте токен из ответа и вставьте его ниже</>,
];

export function ConnectBotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useMutation({
    mutationFn: () => botsApi.connect(token),
    onSuccess: (bot) => {
      toast.success(`Бот @${bot.username} подключён`);
      qc.invalidateQueries({ queryKey: ["bots"] });
      onOpenChange(false);
      setToken("");
      router.push(`/bots/${bot.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, "Не удалось подключить бота")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!connect.isPending) {
          onOpenChange(v);
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Подключить бота</DialogTitle>
          <DialogDescription>Займёт меньше минуты.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-[#3a3a3c]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(6,157,223,0.1)] text-xs font-semibold text-[#2B2E81]">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            connect.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bot-token">Токен бота</Label>
            <div className="relative">
              <Input
                id="bot-token"
                type={show ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="123456789:AAH..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8e8e93] hover:text-[#171717]"
                aria-label={show ? "Скрыть токен" : "Показать токен"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-[#8e8e93]">
              Токен хранится в зашифрованном виде и больше нигде не показывается.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={!token.trim() || connect.isPending}>
            {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Подключить
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
