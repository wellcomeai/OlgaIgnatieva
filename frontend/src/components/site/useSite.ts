"use client";

import { useQuery } from "@tanstack/react-query";

import { siteApi } from "@/api/site";

export function useSite() {
  return useQuery({ queryKey: ["site-info"], queryFn: () => siteApi.info(), staleTime: 60_000 });
}

export const SELLER_STATUS: Record<string, string> = {
  self_employed: "Самозанятый (плательщик налога на профессиональный доход)",
  ip: "Индивидуальный предприниматель",
  company: "Юридическое лицо",
};

/** Значение реквизита или заметная заглушка, пока владелец не заполнил его в кабинете. */
export function req(value: string | undefined, label: string): string {
  return value?.trim() ? value.trim() : `[${label} — укажите в кабинете → Интеграции]`;
}
