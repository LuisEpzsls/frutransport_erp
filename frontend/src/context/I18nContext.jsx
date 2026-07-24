import { createContext, useContext, useState, useEffect } from "react";
import { STRINGS, detectLang } from "../i18n/strings.js";

const I18nContext = createContext({ lang: "es", t: () => "", setLang: () => {} });

export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("es");
  const [source, setSource] = useState("default");

  useEffect(() => {
    const d = detectLang();
    setLangState(d.lang);
    setSource(d.source);
    document.documentElement.lang = STRINGS[d.lang].locale;
  }, []);

  const setLang = (next) => {
    if (!STRINGS[next]) return;
    setLangState(next);
    setSource("manual");
    try { localStorage.setItem("frt_lang", next); } catch (e) {}
    document.documentElement.lang = STRINGS[next].locale;
  };

  const t = (path) => {
    const parts = path.split(".");
    let v = STRINGS[lang];
    for (const p of parts) {
      if (v == null) return path;
      v = v[p];
    }
    return v == null ? path : v;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, source, t }}>
      {children}
    </I18nContext.Provider>
  );
}
