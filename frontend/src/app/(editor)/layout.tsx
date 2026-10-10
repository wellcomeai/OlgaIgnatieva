import { AuthGuard } from "@/components/AuthGuard";

// Полноэкранный редактор без сайдбара кабинета
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
