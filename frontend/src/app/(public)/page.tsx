import { redirect } from "next/navigation";

// Платформа личная: лендинг не нужен, сразу ведём в кабинет
// (AuthGuard отправит на /login, если пользователь не вошёл).
export default function HomePage() {
  redirect("/dashboard");
}
