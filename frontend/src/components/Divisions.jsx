import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";
import { DIV_ICONS, IconCorner } from "./icons/index.jsx";

export default function Divisions() {
  const { t, lang } = useI18n();
  const list = STRINGS[lang].divisions.list;
  return (
    <section className="band" id="divisions" data-screen-label="05 Divisions">
      <div className="section-head reveal">
        <div>
          <div className="eyebrow"><span className="num">03</span> {t("divisions.eyebrow")}</div>
          <h2 className="section-title">
            {t("divisions.title_a")}<em>{t("divisions.title_em")}</em>{t("divisions.title_b")}
          </h2>
        </div>
        <p className="section-lede">{t("divisions.lede")}</p>
      </div>

      <div className="div-grid">
        {list.map((d, i) => {
          const Icon = DIV_ICONS[i];
          return (
            <article
              key={i}
              className="div-card reveal"
              style={{ "--reveal-delay": `${i * 90}ms` }}
              data-screen-label={`Card ${d.name}`}
            >
              <div className="index mono">DIV / 0{i + 1}</div>
              <div className="icon-wrap"><Icon /></div>
              <h3>{d.name}</h3>
              <p className="desc">{d.desc}</p>
              <div className="tags">
                {d.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>
              <div className="corner"><IconCorner /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
