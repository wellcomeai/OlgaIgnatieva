import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen mesh-bg flex flex-col noise overflow-hidden">
      {/* Header */}
      <header style={{ padding: '20px 28px' }}>
        <Link
          href="/"
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none' }}
        >
          <BrandLogo size={30} />
        </Link>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
