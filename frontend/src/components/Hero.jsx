import { useI18n } from "../context/I18nContext.jsx";
import { IconArrow } from "./icons/index.jsx";
import ImagePlaceholder from "./ImagePlaceholder.jsx";

export default function Hero() {
  const { t } = useI18n();
  return (
    <section className="hero" data-screen-label="02 Hero" id="home">
      <div className="hero-meta reveal">
        <span><span className="dot" />{t("hero.status")}</span>
        <span>{t("hero.bulletin")}</span>
      </div>

      <div className="hero-grid">
        <div className="hero-copy reveal-left">
          <h1>
            {t("hero.headline_a")} <em>{t("hero.headline_em")}</em>{t("hero.headline_b")}<br />
            {t("hero.headline_c")}
          </h1>
          <p className="hero-sub">{t("hero.sub")}</p>
          <div className="hero-actions">
            <a href="#products" className="btn-primary">
              {t("hero.cta")}
              <span className="arrow"><IconArrow size={11} /></span>
            </a>
            <a href="#contact" className="btn-ghost">{t("hero.ctaSecondary")} →</a>
          </div>

          <div className="hero-stats">
            {["years", "markets", "volume"].map(k => (
              <div className="stat" key={k}>
                <div className="stat-n">
                  {t(`hero.stats.${k}.n`)}
                  <span className="unit">{t(`hero.stats.${k}.unit`)}</span>
                </div>
                <div className="stat-l">{t(`hero.stats.${k}.label`)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-vis reveal-right" aria-label="Composite of featured fruits">
          {["a", "b", "c"].map(k => (
            <div className={`hero-tile ${k}`} key={k}>
              <ImagePlaceholder id={`hero-${k}`} alt={t(`hero.vis.${k}.label`)} eager />
              <div className="id mono">{t(`hero.vis.${k}.id`)}</div>
              {k === "a" && (
                <div className="coord-strip">
                  <span>12°02&apos;S</span><span>77°02&apos;W</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
