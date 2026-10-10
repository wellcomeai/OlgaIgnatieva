"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ExternalLink, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { BLOCKS } from "./blocks";
import { useEditor } from "./context";
import { delayText, outputsFor, triggerText, type FlowNode as FlowNodeT } from "./graph";

const handleCls = "!h-3 !w-3 !border-2 !border-white !shadow";

function Summary({ node }: { node: FlowNodeT }) {
  const { products } = useEditor();
  const d = node.data;
  const product = products.find((p) => p.id === (d.product_id ?? d.value));
  const empty = (s: string) => <span className="italic text-[#b0b0b8]">{s}</span>;

  switch (node.type) {
    case "trigger":
      return <span>{triggerText(d.kind ?? "start", d.value ?? "", product?.title)}</span>;
    case "message":
    case "question":
      return d.text?.trim() ? (
        <span className="line-clamp-3 whitespace-pre-wrap">{d.text.replace(/<[^>]+>/g, "")}</span>
      ) : (
        empty(node.type === "message" ? "Введите текст сообщения" : "Введите вопрос")
      );
    case "delay":
      return <span>Ждать {delayText(d.amount, d.unit)}</span>;
    case "offer":
    case "files":
      return product ? <span className="font-medium">{product.title}</span> : empty("Выберите продукт");
    case "condition":
      if (d.kind === "has_tag") return d.tag ? <span>Есть тег «{d.tag}»?</span> : empty("Укажите тег");
      if (d.kind === "has_var") return d.var ? <span>Ответил на «{d.var}»?</span> : empty("Укажите поле");
      return product ? <span>Купил «{product.title}»?</span> : empty("Выберите продукт");
    case "tag":
      return d.tag ? (
        <span>
          {d.action === "remove" ? "Снять" : "Поставить"} тег «{d.tag}»
        </span>
      ) : (
        empty("Укажите тег")
      );
    default:
      return null;
  }
}

function FlowNodeView({ data, type, id, selected }: NodeProps<FlowNodeT>) {
  const spec = BLOCKS[type];
  const Icon = spec.icon;
  const { stats } = useEditor();
  const outputs = outputsFor(type, data);
  const branches = type === "message" && outputs[0]?.id.startsWith("btn:");
  const urlButtons = type === "message" ? (data.buttons ?? []).filter((b) => b.type === "url") : [];
  const count = stats[id];

  return (
    <div
      className={cn(
        "w-[260px] rounded-2xl border bg-white shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-shadow",
        selected ? "border-[#069DDF] shadow-[0_0_0_3px_rgba(6,157,223,0.2),0_8px_24px_rgba(15,23,42,0.12)]" : "border-black/[0.08]",
      )}
    >
      {type !== "trigger" && (
        <Handle type="target" position={Position.Left} className={handleCls} style={{ background: "#94a3b8" }} />
      )}

      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: spec.color }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[#171717]">{data.title || spec.label}</div>
          {data.title && <div className="text-[10px] uppercase tracking-wider text-[#8e8e93]">{spec.label}</div>}
        </div>
        {count !== undefined && (
          <span
            title="Сколько людей дошло до этого шага"
            className="flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#636366]"
          >
            <Users className="h-3 w-3" /> {count}
          </span>
        )}
      </div>

      <div className="px-3.5 pb-3 pt-2 text-[12px] leading-snug text-[#3a3a3c]">
        <Summary node={{ id, type, data } as FlowNodeT} />
      </div>

      {urlButtons.length > 0 && (
        <div className="space-y-1 px-3.5 pb-2">
          {urlButtons.map((b) => (
            <div key={b.id} className="flex items-center justify-center gap-1 rounded-lg bg-black/[0.04] px-2 py-1 text-[11px] text-[#636366]">
              {b.text || "Ссылка"} <ExternalLink className="h-3 w-3" />
            </div>
          ))}
        </div>
      )}

      {branches || type === "condition" ? (
        <div className="space-y-1 border-t border-black/[0.05] px-3.5 py-2">
          {outputs.map((o) => (
            <div
              key={o.id}
              className={cn(
                "relative rounded-lg px-2 py-1.5 pr-4 text-right text-[11px] font-medium",
                o.id === "yes" ? "bg-emerald-50 text-emerald-700" : o.id === "no" ? "bg-red-50 text-red-700" : "bg-[rgba(6,157,223,0.08)] text-[#2B2E81]",
              )}
            >
              <span className="block truncate">{o.label || "Кнопка"}</span>
              <Handle
                type="source"
                id={o.id}
                position={Position.Right}
                className={cn(handleCls, "!-right-[21px]")}
                style={{ background: o.id === "yes" ? "#10B981" : o.id === "no" ? "#EF4444" : "#069DDF" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" id="next" position={Position.Right} className={handleCls} style={{ background: spec.color }} />
      )}
    </div>
  );
}

export const FlowNodeComponent = memo(FlowNodeView);
