import type { Edge, Node } from "@xyflow/react";

import type { FlowGraph, FlowNodeData, FlowNodeType } from "@/types";

export type FlowNode = Node<FlowNodeData, FlowNodeType>;

/** Короткий id, подходящий под проверку бэкенда ([A-Za-z0-9_-]). */
export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Выходы блока — так же их считает бэкенд (modules/flows/graph.py). */
export function outputsFor(type: FlowNodeType, data: FlowNodeData): { id: string; label?: string }[] {
  if (type === "condition") {
    return [
      { id: "yes", label: "Да" },
      { id: "no", label: "Нет" },
    ];
  }
  if (type === "message") {
    const branches = (data.buttons ?? []).filter((b) => b.type === "next");
    if (branches.length) return branches.map((b) => ({ id: `btn:${b.id}`, label: b.text }));
  }
  return [{ id: "next" }];
}

/** Убрать стрелки от выходов, которых у блока больше нет (например, удалили кнопку). */
export function pruneEdges(nodes: FlowNode[], edges: Edge[]): Edge[] {
  const valid = new Map(nodes.map((n) => [n.id, new Set(outputsFor(n.type as FlowNodeType, n.data).map((o) => o.id))]));
  return edges.filter((e) => valid.get(e.source)?.has(e.sourceHandle ?? "next") && valid.has(e.target));
}

export function fromGraph(graph: FlowGraph): { nodes: FlowNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      deletable: n.type !== "trigger",
    })),
    edges: graph.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle || "next" })),
  };
}

export function toGraph(nodes: FlowNode[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as FlowNodeType,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle ?? "next",
      target: e.target,
    })),
  };
}

export function triggerText(kind: string, value: string, productTitle?: string): string {
  switch (kind) {
    case "start":
      return "Любой /start";
    case "start_label":
      return value ? `/start ${value}` : "/start с меткой";
    case "keyword":
      return value ? `Слово «${value}»` : "Ключевое слово";
    case "purchase":
      return productTitle ? `Оплата «${productTitle}»` : "После оплаты";
    default:
      return kind;
  }
}

export function delayText(amount?: number, unit?: string): string {
  const n = amount ?? 0;
  const forms: Record<string, [string, string, string]> = {
    minutes: ["минуту", "минуты", "минут"],
    hours: ["час", "часа", "часов"],
    days: ["день", "дня", "дней"],
  };
  const f = forms[unit ?? "minutes"] ?? forms.minutes;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? f[0] : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? f[1] : f[2];
  return `${n} ${word}`;
}
