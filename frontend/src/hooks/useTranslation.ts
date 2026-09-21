import languages from "../locales/languages.json";
import { useLocale } from "../contexts/Locale";

type Vars = Record<string, string | number>;

export function useTranslation<NS extends keyof typeof languages>(
  namespace: NS,
) {
  const { lang } = useLocale();
  const dict = languages[namespace] as Record<
    string,
    Partial<Record<string, string>>
  >;

  return (key: keyof (typeof languages)[NS], vars?: Vars): string => {
    const entry = dict[key as string];
    let str = entry?.[lang] ?? entry?.en ?? String(key); // lang → English → key
    if (vars)
      for (const [k, v] of Object.entries(vars))
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    return str;
  };
}
