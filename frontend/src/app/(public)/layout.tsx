import { Onest, Spectral } from "next/font/google";

// Шрифты публичных страниц: засечка для заголовков и цифр, Onest для текста.
// Оба с полной кириллицей — Geist из основного интерфейса её не содержит.
const display = Spectral({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const text = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-text", display: "swap" });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${text.variable} antialiased`}
      style={{ fontFamily: "var(--font-text), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
