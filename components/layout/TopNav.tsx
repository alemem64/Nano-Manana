"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/i18n/useTranslation";

export function TopNav() {
  const pathname = usePathname();
  const t = useTranslation();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-pri bg-pri">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-pri hover:text-hl transition-colors"
            >
              <Image
                src="/nano_manana_logo.png"
                alt="Nano Manana Logo"
                width={32}
                height={32}
                className="rounded-md"
              />
              {t.appName}
            </Link>

            <div className="flex items-center space-x-4">
              <Link
                href="/colorize"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/colorize")
                    ? "bg-hl text-hl"
                    : "text-sec hover:bg-sec hover:text-pri"
                }`}
              >
                {t.nav.colorize}
              </Link>
              <Link
                href="/translate"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/translate")
                    ? "bg-hl text-hl"
                    : "text-sec hover:bg-sec hover:text-pri"
                }`}
              >
                {t.nav.translate}
              </Link>
              <Link
                href="/colorize-and-translate"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/colorize-and-translate")
                    ? "bg-hl text-hl"
                    : "text-sec hover:bg-sec hover:text-pri"
                }`}
              >
                {t.nav.colorizeAndTranslate}
              </Link>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
