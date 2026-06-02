const TEXT_TYPE_LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  bg: "bg",
  ca: "ca",
  cjk: "cjk",
  cz: "cs",
  da: "da",
  de: "de",
  el: "el",
  en: "en",
  en_splitting: "en",
  en_splitting_tight: "en",
  es: "es",
  et: "et",
  eu: "eu",
  fa: "fa",
  fi: "fi",
  fr: "fr",
  ga: "ga",
  gl: "gl",
  hi: "hi",
  hu: "hu",
  hy: "hy",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  lv: "lv",
  nl: "nl",
  no: "no",
  pt: "pt",
  ro: "ro",
  ru: "ru",
  sv: "sv",
  th: "th",
  tr: "tr",
};

export function deriveLocale(typeName: string | undefined | null): string | null {
  if (!typeName) return null;
  if (!typeName.startsWith("text_")) return null;
  const tail = typeName.slice("text_".length);
  return TEXT_TYPE_LOCALE_MAP[tail] ?? null;
}
