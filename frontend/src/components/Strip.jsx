import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";

export default function Strip() {
  const { t, lang } = useI18n();
  const items = STRINGS[lang].strip.items;
  return (
    <section className="strip reveal" id="about" data-screen-label="06 Why us">
      <div className="strip-inner">
        <h2>{t("strip.title_a")}<em>{t("strip.title_em")}</em>{t("strip.title_b")}</h2>
        <ul>
          {items.map((it, i) => (
            <li key={i}>
              <span className="k mono">{it.k}</span>
              <span className="v serif">{it.v}</span>
              <span className="d">{it.d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
