import Image from "next/image";

export const BRAND_NAME = "VisaNews2U";

interface BrandLogoProps {
  /** Высота знака в px; надпись масштабируется пропорционально. */
  size?: number;
  /** `dark` — вариант для тёмного фона. */
  tone?: "light" | "dark";
  /** Показывать только знак (галочка с самолётом), без надписи. */
  markOnly?: boolean;
  priority?: boolean;
}

/** Логотип бренда: знак + надпись из `public/brand/`. */
export function BrandLogo({
  size = 28,
  tone = "light",
  markOnly = false,
  priority = false,
}: BrandLogoProps) {
  const suffix = tone === "dark" ? "-dark" : "";
  // Пропорции исходных SVG (см. viewBox в public/brand/*.svg)
  const markWidth = Math.round((size * 1880) / 1240);
  const wordHeight = Math.round(size * 0.52);
  const wordWidth = Math.round((wordHeight * 3366) / 390);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Image
        src={`/brand/mark${suffix}.svg`}
        alt={markOnly ? BRAND_NAME : ""}
        width={markWidth}
        height={size}
        priority={priority}
      />
      {!markOnly && (
        <Image
          src={`/brand/wordmark${suffix}.svg`}
          alt={BRAND_NAME}
          width={wordWidth}
          height={wordHeight}
          priority={priority}
        />
      )}
    </span>
  );
}
