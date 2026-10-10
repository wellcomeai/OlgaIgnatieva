import { apiClient } from "./client";
import type { FlowDetail, FlowGraph, FlowSummary, FlowTemplate } from "@/types";

export const flowsApi = {
  async list(botId: string): Promise<FlowSummary[]> {
    const r = await apiClient.get(`/api/v1/bots/${botId}/flows`);
    return r.data;
  },

  async create(botId: string, name: string, template: FlowTemplate): Promise<FlowDetail> {
    const r = await apiClient.post(`/api/v1/bots/${botId}/flows`, { name, template });
    return r.data;
  },

  async get(id: string): Promise<FlowDetail> {
    const r = await apiClient.get(`/api/v1/flows/${id}`);
    return r.data;
  },

  async update(
    id: string,
    data: { name?: string; graph?: FlowGraph; is_active?: boolean },
  ): Promise<FlowDetail> {
    const r = await apiClient.put(`/api/v1/flows/${id}`, data);
    return r.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/flows/${id}`);
  },
};
