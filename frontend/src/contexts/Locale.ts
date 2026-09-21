import { createContext, useContext } from "react";

export type Lang = "en" | "de" | "ja";

export interface LocaleContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({
  lang: "en",
  setLang: () => {},
});

export const useLocale = () => useContext(LocaleContext);
