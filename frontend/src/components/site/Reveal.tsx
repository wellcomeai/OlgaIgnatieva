"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type Side = "below" | "visible" | "above";

interface RevealProps {
  children: ReactNode;
  /** Задержка появления, мс — для «лесенки» в списках. */
  delay?: number;
  /** Сдвиг до появления, px. */
  distance?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/**
 * Плавное появление при скролле в обе стороны: элемент въезжает с той
 * стороны, откуда попадает в экран (снизу при прокрутке вниз, сверху —
 * при прокрутке вверх) и прячется, когда уходит из видимой области.
 * При prefers-reduced-motion показывается сразу, без движения.
 */
export function Reveal({ children, delay = 0, distance = 28, as: Tag = "div", className, style }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [side, setSide] = useState<Side>("below");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setSide("visible");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSide("visible");
        else setSide(entry.boundingClientRect.top < 0 ? "above" : "below");
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const offset = side === "below" ? distance : side === "above" ? -distance : 0;
  const ease = "cubic-bezier(0.22, 0.61, 0.36, 1)";

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: side === "visible" ? 1 : 0,
        transform: reduced ? undefined : `translate3d(0, ${offset}px, 0)`,
        transition: reduced
          ? undefined
          : `opacity 650ms ${ease} ${side === "visible" ? delay : 0}ms, transform 750ms ${ease} ${side === "visible" ? delay : 0}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}
