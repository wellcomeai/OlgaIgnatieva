import { apiClient } from "./client";
import type {
  Bot,
  BotSourceStat,
  BotSubscriberPage,
  BotUpdate,
  BotWebhookInfo,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const botsApi = {
  async list(): Promise<Bot[]> {
    const r = await apiClient.get("/api/v1/bots");
    return r.data;
  },

  async get(id: string): Promise<Bot> {
    const r = await apiClient.get(`/api/v1/bots/${id}`);
    return r.data;
  },

  async connect(token: string): Promise<Bot> {
    const r = await apiClient.post("/api/v1/bots", { token });
    return r.data;
  },

  async update(id: string, data: BotUpdate): Promise<Bot> {
    const r = await apiClient.patch(`/api/v1/bots/${id}`, data);
    return r.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/bots/${id}`);
  },

  async refreshWebhook(id: string): Promise<Bot> {
    const r = await apiClient.post(`/api/v1/bots/${id}/webhook`);
    return r.data;
  },

  async webhookInfo(id: string): Promise<BotWebhookInfo> {
    const r = await apiClient.get(`/api/v1/bots/${id}/webhook`);
    return r.data;
  },

  async subscribers(
    id: string,
    params: { search?: string; limit?: number; offset?: number },
  ): Promise<BotSubscriberPage> {
    const r = await apiClient.get(`/api/v1/bots/${id}/subscribers`, { params });
    return r.data;
  },

  async sources(id: string): Promise<BotSourceStat[]> {
    const r = await apiClient.get(`/api/v1/bots/${id}/sources`);
    return r.data;
  },

  avatarUrl(id: string): string {
    return `${API_URL}/api/v1/tg/${id}/avatar`;
  },
};
