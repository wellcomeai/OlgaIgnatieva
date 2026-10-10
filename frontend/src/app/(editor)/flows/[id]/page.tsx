"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Workflow } from "lucide-react";

import { botsApi } from "@/api/bots";
import { flowsApi } from "@/api/flows";
import { productsApi } from "@/api/shop";
import { FlowEditor } from "@/components/flows/FlowEditor";
import { EmptyState } from "@/components/ui/empty-state";

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const flow = useQuery({ queryKey: ["flow", id], queryFn: () => flowsApi.get(id), retry: false });
  const products = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list() });
  const bot = useQuery({
    queryKey: ["bot", flow.data?.bot_id],
    queryFn: () => botsApi.get(flow.data!.bot_id),
    enabled: !!flow.data,
  });

  if (flow.isError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState icon={Workflow} title="Воронка не найдена" description="Возможно, она была удалена." action={{ label: "К ботам", href: "/bots" }} />
      </div>
    );
  }
  if (!flow.data || !products.data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // key: после сохранения с сервера приходит обновлённая статистика/проблемы,
  // но перемонтировать холст нужно только при смене воронки
  return <FlowEditor key={flow.data.id} flow={flow.data} products={products.data} botUsername={bot.data?.username ?? ""} />;
}
