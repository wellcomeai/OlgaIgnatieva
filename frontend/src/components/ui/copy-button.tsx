"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  message = "Скопировано",
  className,
}: {
  value: string;
  message?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(message);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-black/[0.05] hover:text-[#2B2E81]",
        className,
      )}
      aria-label="Скопировать"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
