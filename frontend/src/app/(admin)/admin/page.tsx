import { redirect } from "next/navigation";

// Обзор SaaS-метрик шаблона не нужен: статистика продаж — в «Заказах».
export default function AdminIndexPage() {
  redirect("/admin/integrations");
}
