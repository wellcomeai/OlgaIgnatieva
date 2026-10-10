import { PaymentResult } from "@/components/shop/PaymentResult";

export const metadata = { title: "Оплата не прошла — VisaNews2U" };

export default function PayFailPage() {
  return <PaymentResult ok={false} />;
}
