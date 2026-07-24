import { useI18n } from "../context/I18nContext.jsx";
import ImagePlaceholder from "./ImagePlaceholder.jsx";

const SLOTS = [
  { key: "field", cls: "tall" },
  { key: "fruits", cls: "" },
  { key: "andes", cls: "" },
  { key: "market", cls: "" },
  { key: "port", cls: "" },
];

export default function HeritageGallery() {
  const { t } = useI18n();
  return (
    <section className="heritage" data-screen-label="04 Heritage" id="heritage">
      <div className="heritage-inner">
        <div className="andean-strip" aria-hidden="true" />
        <div className="heritage-head reveal">
          <div>
            <div className="eyebrow"><span className="num">02</span> {t("heritage.eyebrow")}</div>
            <h2 className="section-title">
              {t("heritage.title_a")}<em>{t("heritage.title_em")}</em>{t("heritage.title_b")}
            </h2>
          </div>
          <p className="section-lede">{t("heritage.lede")}</p>
        </div>

        <div className="heritage-grid">
          {SLOTS.map((s, idx) => (
            <div
              className={"heritage-slot reveal " + s.cls}
              style={{ "--reveal-delay": `${idx * 120}ms` }}
              key={s.key}
            >
              <ImagePlaceholder id={`heritage-${s.key}`} alt={t(`heritage.slots.${s.key}.placeholder`)} />
              <div className="heritage-caption">
                <span className="pill">{t("heritage.pill")}</span>
                <span>{t(`heritage.slots.${s.key}.caption`)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
