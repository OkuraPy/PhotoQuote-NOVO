// PhotoQuote v2 — device-language helper. Pure module (zero imports) so it stays unit-testable;
// i18n.tsx feeds it the language codes reported by expo-localization.

const SUPPORTED = ['en', 'es', 'pt'] as const;
type Supported = (typeof SUPPORTED)[number];

// Picks the first supported language from a list of BCP-47 tags / language codes.
// Normalizes case and keeps only the language prefix ('pt-BR' → 'pt', 'es-419' → 'es',
// 'en-US' → 'en'); null/undefined/unknown entries are skipped. Nothing supported → 'en'.
export function pickLocale(tags: ReadonlyArray<string | null | undefined>): 'en' | 'es' | 'pt' {
  for (const tag of tags) {
    if (!tag) continue;
    const lang = tag.toLowerCase().split('-')[0];
    if ((SUPPORTED as ReadonlyArray<string>).includes(lang)) return lang as Supported;
  }
  return 'en';
}
