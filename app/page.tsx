"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/i18n/useTranslation";
import { Paintbrush, Languages, Sparkles } from "lucide-react";

export default function Home() {
  const t = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24">
      {/* Hero */}
      <div className="flex items-center gap-4 mb-4">
        <Image
          src="/nano_manana_logo.png"
          alt="Nano Manana Logo"
          width={64}
          height={64}
          className="rounded-lg"
        />
        <h1 className="text-4xl md:text-5xl font-bold text-pri text-center">
          {t.appName}
        </h1>
      </div>
      <p className="text-lg text-sec text-center mb-16 max-w-md">
        {t.home.hero}
      </p>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        {/* Colorize Card */}
        <Link
          href="/colorize"
          className="group p-8 rounded-lg bg-sec border-2 border-sec hover:border-[var(--hl-bd)] hover:bg-hl transition-all"
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-ter group-hover:bg-pri mb-4 transition-colors">
              <Paintbrush className="h-8 w-8 text-sec group-hover:text-hl" />
            </div>
            <h2 className="text-xl font-semibold text-pri group-hover:text-hl mb-2">
              {t.home.colorizeCard.title}
            </h2>
            <p className="text-sm text-sec group-hover:text-hl">
              {t.home.colorizeCard.description}
            </p>
          </div>
        </Link>

        {/* Translate Card */}
        <Link
          href="/translate"
          className="group p-8 rounded-lg bg-sec border-2 border-sec hover:border-[var(--hl-bd)] hover:bg-hl transition-all"
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-ter group-hover:bg-pri mb-4 transition-colors">
              <Languages className="h-8 w-8 text-sec group-hover:text-hl" />
            </div>
            <h2 className="text-xl font-semibold text-pri group-hover:text-hl mb-2">
              {t.home.translateCard.title}
            </h2>
            <p className="text-sm text-sec group-hover:text-hl">
              {t.home.translateCard.description}
            </p>
          </div>
        </Link>

        {/* Colorize & Translate Card */}
        <Link
          href="/colorize-and-translate"
          className="group p-8 rounded-lg bg-sec border-2 border-sec hover:border-[var(--hl-bd)] hover:bg-hl transition-all"
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-ter group-hover:bg-pri mb-4 transition-colors">
              <Sparkles className="h-8 w-8 text-sec group-hover:text-hl" />
            </div>
            <h2 className="text-xl font-semibold text-pri group-hover:text-hl mb-2">
              {t.home.colorizeAndTranslateCard.title}
            </h2>
            <p className="text-sm text-sec group-hover:text-hl">
              {t.home.colorizeAndTranslateCard.description}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
