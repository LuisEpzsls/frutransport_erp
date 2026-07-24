import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";

/** Prueba social: clientes reales verificados (CONTENEDORES.xlsx), justo antes del CTA final. */
export default function Clients() {
  const { t, lang } = useI18n();
  const list = STRINGS[lang].clients.list;
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

      <ul className="clients-grid">
        {list.map((c, i) => (
          <li
            key={c.name}
            className="client-card reveal"
            style={{ "--reveal-delay": `${i * 70}ms` }}
          >
            <span className="client-name">{c.name}</span>
            <span className="client-country mono">{c.country}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
