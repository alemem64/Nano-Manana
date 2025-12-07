"use client";

import { en, TranslationKeys } from "./en";

export function useTranslation(): TranslationKeys {
  // For now, we only support English
  // This can be extended to support multiple languages in the future
  return en;
}
