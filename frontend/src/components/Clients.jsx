import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";

/**
 * Presencia internacional: solo países, no nombres de empresa — usar el
 * nombre real de un cliente como referencia de marketing sin su
 * consentimiento explícito es un riesgo de confidencialidad, no solo
 * estético (decisión de negocio, 2026-07-24).
 */
export default function Clients() {
  const { t, lang } = useI18n();
  const countries = STRINGS[lang].clients.countries;
  return (
    <section className="band" id="clients" data-screen-label="05b Clients">
      <div className="section-head reveal">
        <div>
          <div className="eyebrow"><span className="num">04</span> {t("clients.eyebrow")}</div>
          <h2 className="section-title">
            {t("clients.title_a")}<em>{t("clients.title_em")}</em>{t("clients.title_b")}
          </h2>
        </div>
        <p className="section-lede">{t("clients.lede")}</p>
      </div>

      <ul className="countries-row">
        {countries.map((country, i) => (
          <li
            key={country}
            className="country-badge reveal"
            style={{ "--reveal-delay": `${i * 70}ms` }}
          >
            {country}
          </li>
        ))}
      </ul>
    </section>
  );
}
