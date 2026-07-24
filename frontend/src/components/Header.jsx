import { useState, useRef, useEffect } from "react";
import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS, LANGS } from "../i18n/strings.js";
import { IconGlobe, IconChev, IconPerson } from "./icons/index.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

function LangSwitcher() {
  const { lang, setLang, source, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="lang-switch" ref={ref}>
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="globe"><IconGlobe size={13} /></span>
        <span>{lang.toUpperCase()}</span>
        <span className="chev"><IconChev /></span>
      </button>
      <div className={"lang-menu" + (open ? " open" : "")} role="listbox">
        {source !== "manual" && source !== "default" && (
          <div className="lang-detect-row">
            <span className="dot-mini" />
            <span>{t("lang.detected")}</span>
          </div>
        )}
        {LANGS.map(l => (
          <button key={l} type="button" role="option" aria-selected={l === lang}
            className={"lang-item" + (l === lang ? " active" : "")}
            onClick={() => { setLang(l); setOpen(false); }}>
            <span>
              <span className="native">{STRINGS[l].lang[l].native}</span>
              {l !== lang && <span className="english">· {t(`lang.${l}.english`)}</span>}
            </span>
            <span className="code">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonButton({ onClick }) {
  const { t } = useI18n();
  return (
    <button type="button" className="person-btn" onClick={onClick} aria-label={t("person.ariaLabel")}>
      <IconPerson size={17} />
      <span className="pulse" aria-hidden="true" />
      <span className="person-tip">{t("person.tooltip")}</span>
    </button>
  );
}

export default function Header({ onOpenAccount }) {
  const { t } = useI18n();
  return (
    <div className="nav-shell" data-screen-label="01 Header">
      <div className="nav">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 19V5h12" /><path d="M5 12h9" /><path d="M14 8l5 4-5 4" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Frutransport</span>
            <span className="brand-tag">{t("brand.tag")}</span>
          </div>
        </div>
        <nav className="nav-links" aria-label="Primary">
          <a href="#home" className="active">{t("nav.home")}</a>
          <a href="#products">{t("nav.products")}</a>
          <a href="#about">{t("nav.about")}</a>
          <a href="#divisions">{t("nav.services")}</a>
          <a href="#contact">{t("nav.contact")}</a>
        </nav>
        <div className="nav-right">
          <ThemeToggle />
          <LangSwitcher />
          <PersonButton onClick={onOpenAccount} />
        </div>
      </div>
    </div>
  );
}
