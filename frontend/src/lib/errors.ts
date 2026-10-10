import { AxiosError } from "axios";

/** Текст ошибки из ответа FastAPI: `detail` строкой или списком ошибок валидации. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}
