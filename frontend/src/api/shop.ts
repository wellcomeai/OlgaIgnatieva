import { apiClient } from "./client";
import type {
  OrderPage,
  OrderStats,
  OrderStatus,
  PaymentsConfig,
  Product,
  ProductDetail,
  ProductFile,
  ProductUpdate,
} from "@/types";

export const productsApi = {
  async list(): Promise<Product[]> {
    const r = await apiClient.get("/api/v1/products");
    return r.data;
  },

  async get(id: string): Promise<ProductDetail> {
    const r = await apiClient.get(`/api/v1/products/${id}`);
    return r.data;
  },

  async create(data: { title: string; price: string; description?: string }): Promise<ProductDetail> {
    const r = await apiClient.post("/api/v1/products", data);
    return r.data;
  },

  async update(id: string, data: ProductUpdate): Promise<ProductDetail> {
    const r = await apiClient.patch(`/api/v1/products/${id}`, data);
    return r.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/products/${id}`);
  },

  async uploadFile(
    id: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ProductFile> {
    const form = new FormData();
    form.append("file", file);
    const r = await apiClient.post(`/api/v1/products/${id}/files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return r.data;
  },

  async removeFile(id: string, fileId: string): Promise<void> {
    await apiClient.delete(`/api/v1/products/${id}/files/${fileId}`);
  },
};

export const ordersApi = {
  async list(params: { status?: OrderStatus; limit?: number; offset?: number }): Promise<OrderPage> {
    const r = await apiClient.get("/api/v1/orders", { params });
    return r.data;
  },

  async stats(): Promise<OrderStats> {
    const r = await apiClient.get("/api/v1/orders/stats");
    return r.data;
  },

  async redeliver(id: string): Promise<void> {
    await apiClient.post(`/api/v1/orders/${id}/deliver`);
  },

  async paymentsConfig(): Promise<PaymentsConfig> {
    const r = await apiClient.get("/api/v1/payments/config");
    return r.data;
  },
};
