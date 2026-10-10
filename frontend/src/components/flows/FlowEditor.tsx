"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { flowsApi } from "@/api/flows";
import { apiErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { FlowDetail, FlowNodeData, FlowNodeType, Product } from "@/types";
import { BLOCKS, PALETTE } from "./blocks";
import { EditorContext } from "./context";
import { FlowNodeComponent } from "./FlowNode";
import { fromGraph, newId, pruneEdges, toGraph, type FlowNode } from "./graph";
import { Inspector } from "./Inspector";

const nodeTypes = Object.fromEntries(Object.keys(BLOCKS).map((t) => [t, FlowNodeComponent]));
const DND_TYPE = "application/x-flow-block";

interface Props {
  flow: FlowDetail;
  products: Product[];
  botUsername: string;
}

function Editor({ flow, products, botUsername }: Props) {
  const qc = useQueryClient();
  const rf = useReactFlow();
  const initial = useMemo(() => fromGraph(flow.graph), [flow.graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [name, setName] = useState(flow.name);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState(() => JSON.stringify([flow.name, toGraph(initial.nodes, initial.edges)]));
  const [showProblems, setShowProblems] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const currentKey = JSON.stringify([name, toGraph(nodes, edges)]);
  const dirty = currentKey !== savedKey;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const applyServer = (f: FlowDetail) => {
    qc.setQueryData(["flow", f.id], f);
    qc.invalidateQueries({ queryKey: ["flows", f.bot_id] });
  };

  const save = useMutation({
    mutationFn: (opts: { is_active?: boolean } = {}) =>
      flowsApi.update(flow.id, { name: name.trim() || "Без названия", graph: toGraph(nodes, edges), ...opts }),
    onSuccess: (f, opts) => {
      applyServer(f);
      setSavedKey(JSON.stringify([f.name, f.graph]));
      if (opts?.is_active === true) toast.success("Воронка включена — бот уже работает по ней");
      else if (opts?.is_active === false) toast.success("Воронка выключена");
      else toast.success(f.problems.length ? "Черновик сохранён" : "Сохранено");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Не удалось сохранить"), { duration: 8000 }),
  });

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!save.isPending) save.mutate({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Предупредить о несохранённых изменениях при уходе со страницы
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...c, id: newId("e"), sourceHandle: c.sourceHandle ?? "next" },
          // из одного выхода — одна стрелка: новая заменяет старую
          eds.filter((e) => !(e.source === c.source && (e.sourceHandle ?? "next") === (c.sourceHandle ?? "next"))),
        ),
      ),
    [setEdges],
  );

  const addBlock = useCallback(
    (type: FlowNodeType, position?: { x: number; y: number }) => {
      const id = newId(type.slice(0, 3));
      let pos = position;
      if (!pos) {
        const box = wrapper.current?.getBoundingClientRect();
        const center = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 400, y: 300 };
        pos = rf.screenToFlowPosition(center);
        pos = { x: pos.x - 130 + (Math.random() * 40 - 20), y: pos.y - 50 + (Math.random() * 40 - 20) };
      }
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id, type, position: pos!, data: BLOCKS[type].defaults(), selected: true },
      ]);
      setSelectedId(id);
    },
    [rf, setNodes],
  );

  const updateData = (id: string, data: FlowNodeData) => {
    setNodes((ns) => {
      const next = ns.map((n) => (n.id === id ? { ...n, data } : n));
      setEdges((eds) => pruneEdges(next, eds));
      return next;
    });
  };

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const problems = flow.problems;

  return (
    <EditorContext.Provider value={{ stats: flow.node_stats, products, botUsername }}>
      <div className="flex h-screen flex-col bg-[#f6f7fb]">
        {/* Верхняя панель */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/[0.07] bg-white px-4">
          <Link
            href={`/bots/${flow.bot_id}?tab=flows`}
            onClick={(e) => {
              if (dirty && !window.confirm("Есть несохранённые изменения. Уйти без сохранения?")) e.preventDefault();
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#636366] hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">К боту</span>
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            className="min-w-0 max-w-xs flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold hover:border-black/[0.08] focus:border-[#069DDF] focus:outline-none"
          />
          <span
            className={cn(
              "hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
              flow.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600",
            )}
          >
            {flow.is_active ? "● Активна" : "Черновик"}
          </span>
          <div className="flex-1" />

          {problems.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProblems((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {problems.length}{" "}
                <span className="hidden md:inline">не заполнено</span>
              </button>
              {showProblems && (
                <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-black/[0.08] bg-white p-3 text-xs shadow-xl">
                  <div className="mb-2 font-semibold">Что нужно сделать, чтобы включить:</div>
                  <ul className="list-disc space-y-1 pl-4 text-[#3a3a3c]">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[#8e8e93]">Список обновляется после сохранения.</div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ is_active: !flow.is_active })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              flow.is_active ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {flow.is_active ? "Выключить" : "Включить"}
          </button>
          <button
            type="button"
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate({})}
            className="flex items-center gap-1.5 rounded-lg bg-[#2B2E81] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#22256B] disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {dirty ? "Сохранить" : "Сохранено"}
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Палитра */}
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-black/[0.07] bg-white p-3 md:block">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">Блоки</div>
            <div className="space-y-1.5">
              {PALETTE.map((type) => {
                const b = BLOCKS[type];
                const Icon = b.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_TYPE, type);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => addBlock(type)}
                    className="flex w-full cursor-grab items-center gap-2.5 rounded-xl border border-black/[0.06] p-2.5 text-left transition hover:border-black/[0.12] hover:shadow-sm active:cursor-grabbing"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: b.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-[#171717]">{b.label}</span>
                      <span className="block truncate text-[11px] text-[#8e8e93]">{b.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-[rgba(6,157,223,0.06)] p-3 text-[11px] leading-relaxed text-[#3a3a3c]">
              <b>Как собрать:</b> перетащите блок на холст и протяните стрелку от кружка справа к следующему
              блоку. Стрелку или блок удаляет клавиша Delete.
            </div>
          </aside>

          {/* Холст */}
          <div
            ref={wrapper}
            className="relative min-w-0 flex-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              const type = e.dataTransfer.getData(DND_TYPE) as FlowNodeType;
              if (!type) return;
              e.preventDefault();
              const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
              addBlock(type, { x: p.x - 130, y: p.y - 40 });
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={({ nodes: sel }) => setSelectedId(sel.length === 1 ? sel[0].id : null)}
              onNodesDelete={(deleted) => deleted.some((n) => n.id === selectedId) && setSelectedId(null)}
              deleteKeyCode={["Delete", "Backspace"]}
              defaultEdgeOptions={{ type: "smoothstep", style: { strokeWidth: 2, stroke: "#94a3b8" } }}
              connectionLineStyle={{ strokeWidth: 2, stroke: "#069DDF" }}
              fitView
              // не отдалять сильнее 0.75 — иначе текст блоков нечитаем; остальное видно на мини-карте
              fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.75 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!hidden lg:!block" nodeColor={(n) => BLOCKS[n.type as FlowNodeType]?.color ?? "#999"} />
            </ReactFlow>

            {/* Мобильная палитра */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-2xl bg-white p-1.5 shadow-lg md:hidden">
              {PALETTE.map((type) => {
                const Icon = BLOCKS[type].icon;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-label={BLOCKS[type].label}
                    onClick={() => addBlock(type)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                    style={{ background: BLOCKS[type].color }}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Настройки блока */}
          {selected && (
            <aside className="absolute inset-y-14 right-0 z-20 w-full max-w-[360px] border-l border-black/[0.07] bg-white shadow-xl lg:static lg:shadow-none">
              <Inspector
                key={selected.id}
                node={selected}
                onChange={(data) => updateData(selected.id, data)}
                onDelete={() => deleteNode(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            </aside>
          )}
        </div>
      </div>
    </EditorContext.Provider>
  );
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
