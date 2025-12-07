"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useTranslation } from "@/i18n/useTranslation";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-md bg-sec hover:bg-ter transition-colors"
        aria-label={t.theme.toggle}
      >
        <Sun className="h-5 w-5 text-sec" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md bg-sec hover:bg-ter transition-colors"
      aria-label={t.theme.toggle}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-sec" />
      ) : (
        <Moon className="h-5 w-5 text-sec" />
      )}
    </button>
  );
}
