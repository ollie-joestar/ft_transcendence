import { useEffect, useState, type ReactNode } from "react";
import { LocaleContext, type Lang } from "./Locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("lang") as Lang) ?? "en",
  );
  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <LocaleContext.Provider value={{ lang, setLang }}>
      {children}
    </LocaleContext.Provider>
  );
}
