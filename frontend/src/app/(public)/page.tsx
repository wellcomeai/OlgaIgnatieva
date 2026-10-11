import type { Metadata } from "next";

import { GuideLanding } from "@/components/site/GuideLanding";

export const metadata: Metadata = {
  title: "Виза США B1/B2 самостоятельно — пошаговый гайд | VisaNews2U",
  description:
    "Пошаговый гайд для граждан РФ: фото, анкета DS-160, запись и собеседование, чек-лист. PDF на 16 страниц сразу в Telegram после оплаты.",
};

export default function HomePage() {
  return <GuideLanding />;
}
