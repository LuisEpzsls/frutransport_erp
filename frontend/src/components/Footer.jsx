import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";

export default function Footer() {
  const { t, lang } = useI18n();
  const F = STRINGS[lang].footer;
  const divList = STRINGS[lang].divisions.list;
  return (
    <footer id="contact" data-screen-label="07 Footer">
      <div className="andean-strip dark" aria-hidden="true" style={{ margin: 0, opacity: 0.5 }} />
      <div className="foot">
        <div>
          <div className="brand" style={{ marginBottom: 18 }}>
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
          <p className="addr">
            {F.addr.split("\n").map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
          <div className="contact">
            {F.contact.map((c, i) => <span key={i}>{c}</span>)}
          </div>
        </div>

        <div>
          <h4>{F.cols.divisions}</h4>
          <ul>
            {divList.map((d, i) => (
              <li key={i}><a href="#divisions">{d.name}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{F.cols.company}</h4>
          <ul>
            {F.companyLinks.map((l, i) => (
              <li key={i}><a href={i === 0 ? "#about" : "#"}>{l}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{F.cols.clients}</h4>
          <ul>
            {F.clientLinks.map((l, i) => (
              <li key={i}><a href="#">{l}</a></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="foot-base">
        <span>{F.legalLine}</span>
        <div className="legal">
          {F.legal.map((l, i) => <a key={i} href="#">{l}</a>)}
        </div>
      </div>
    </footer>
  );
}
