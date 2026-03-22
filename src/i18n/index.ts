import { en } from "./en";
import { pl } from "./pl";
import { TranslationKeys } from "./types";

const locales: Record<string, TranslationKeys> = { en, pl };
let active: TranslationKeys = en;

export function initLocale(): void {
  const lang = window.localStorage.getItem("language") || "en";
  active = locales[lang] ?? en;
}

export function t(key: keyof TranslationKeys): string {
  return active[key] ?? en[key] ?? key;
}
