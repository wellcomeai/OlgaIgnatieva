/** «1 490,50» → "1490.50"; null, если сумма некорректна (1 … 1 000 000, до копеек). */
export function normalizePrice(input: string): string | null {
  const s = input.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (n < 1 || n > 1_000_000) return null;
  return n.toFixed(2);
}

/** "1490.50" → «1 490,50 ₽», "990.00" → «990 ₽». */
export function formatRub(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n) + " ₽"
  );
}
