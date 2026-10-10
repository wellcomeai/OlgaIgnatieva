import { apiClient } from "./client";
import type { IntegrationsState } from "@/types";

export const integrationsApi = {
  async get(): Promise<IntegrationsState> {
    const r = await apiClient.get("/api/v1/settings/integrations");
    return r.data;
  },

  async update(values: Record<string, unknown>, reset: string[] = []): Promise<IntegrationsState> {
    const r = await apiClient.put("/api/v1/settings/integrations", { values, reset });
    return r.data;
  },
};
