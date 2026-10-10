import {
  Clock,
  FileDown,
  GitBranch,
  MessageCircleQuestion,
  MessageSquareText,
  Play,
  ShoppingCart,
  Tag,
  type LucideIcon,
} from "lucide-react";

import type { FlowNodeData, FlowNodeType } from "@/types";

export interface BlockSpec {
  type: FlowNodeType;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
  defaults: () => FlowNodeData;
}

export const BLOCKS: Record<FlowNodeType, BlockSpec> = {
  trigger: {
    type: "trigger",
    label: "Старт",
    hint: "С чего начинается воронка",
    icon: Play,
    color: "#10B981",
    defaults: () => ({ kind: "start", value: "" }),
  },
  message: {
    type: "message",
    label: "Сообщение",
    hint: "Текст и кнопки: ссылки или ветки",
    icon: MessageSquareText,
    color: "#069DDF",
    defaults: () => ({ text: "", buttons: [] }),
  },
  delay: {
    type: "delay",
    label: "Пауза",
    hint: "Подождать минуты, часы или дни",
    icon: Clock,
    color: "#F59E0B",
    defaults: () => ({ amount: 1, unit: "hours" }),
  },
  question: {
    type: "question",
    label: "Вопрос",
    hint: "Спросить email, телефон или имя",
    icon: MessageCircleQuestion,
    color: "#8B5CF6",
    defaults: () => ({ text: "", var: "email", validate: "email" }),
  },
  offer: {
    type: "offer",
    label: "Продажа",
    hint: "Карточка продукта с оплатой",
    icon: ShoppingCart,
    color: "#2B2E81",
    defaults: () => ({ product_id: null }),
  },
  files: {
    type: "files",
    label: "Файлы",
    hint: "Отправить файлы продукта бесплатно",
    icon: FileDown,
    color: "#14B8A6",
    defaults: () => ({ product_id: null }),
  },
  condition: {
    type: "condition",
    label: "Условие",
    hint: "Развилка «да / нет»",
    icon: GitBranch,
    color: "#F97316",
    defaults: () => ({ kind: "purchased", product_id: null }),
  },
  tag: {
    type: "tag",
    label: "Тег",
    hint: "Пометить подписчика",
    icon: Tag,
    color: "#EC4899",
    defaults: () => ({ action: "add", tag: "" }),
  },
};

export const PALETTE: FlowNodeType[] = ["message", "delay", "question", "offer", "files", "condition", "tag"];

export const TRIGGER_KINDS = [
  { value: "start", label: "Любой /start", hint: "Человек нажал «Старт» в боте" },
  { value: "start_label", label: "/start с меткой", hint: "Перешёл по ссылке t.me/бот?start=метка" },
  { value: "keyword", label: "Ключевое слово", hint: "Написал слово, например «гайд»" },
  { value: "purchase", label: "После оплаты", hint: "Оплатил выбранный продукт" },
] as const;

export const UNITS = [
  { value: "minutes", label: "минут" },
  { value: "hours", label: "часов" },
  { value: "days", label: "дней" },
] as const;
