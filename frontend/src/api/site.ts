import { apiClient } from "./client";
import type { SiteInfo } from "@/types";

export const siteApi = {
  async info(): Promise<SiteInfo> {
    const r = await apiClient.get("/api/v1/public/site");
    return r.data;
  },
};
