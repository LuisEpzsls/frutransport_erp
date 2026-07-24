import { useI18n } from "../context/I18nContext.jsx";
import { STRINGS } from "../i18n/strings.js";
import ImagePlaceholder from "./ImagePlaceholder.jsx";

// Mismo orden que products.list en strings.js (idéntico en los 4 idiomas):
// Mandarina, Palta, Arándano, Uva, Mango, Espárrago. Se usa el slug, no el
// índice numérico, para que reordenar products.list no desalinee las fotos
// (images.js expone "product-<slug>").
const PRODUCT_SLUGS = ["mandarina", "palta", "arandano", "uva", "mango", "esparrago"];

function SeasonCalendar({ months, monthLabels, peakLabel, activeLabel }) {
  return (
    <div className="pcal">
      <div className="pcal-label">
        <span>{monthLabels.join(" · ")}</span>
      </div>
      <div className="pcal-months" aria-label="Harvest calendar">
        {months.map((m, i) => (
          <span
            key={i}
            className={"pcal-month" + (m === 1 ? " on" : m === 2 ? " peak" : "")}
            title={monthLabels[i]}
          />
        ))}
      </div>
      <div className="pcal-legend">
        <span><span className="sw peak" />{peakLabel}</span>
        <span><span className="sw on" />{activeLabel}</span>
      </div>
    </div>
  );
}

export default function ProductsGrid() {
  const { t, lang } = useI18n();
  const P = STRINGS[lang].products;
  return (
    <section className="products" id="products" data-screen-label="03 Products">
      <div className="products-inner">
        <div className="section-head reveal">
          <div>
            <div className="eyebrow"><span className="num">01</span> {t("products.eyebrow")}</div>
            <h2 className="section-title">
              {t("products.title_a")}<em>{t("products.title_em")}</em>{t("products.title_b")}
            </h2>
          </div>
          <p className="section-lede">{t("products.lede")}</p>
        </div>

        <div className="products-grid">
          {P.list.map((p, i) => (
            <article
              key={i}
              className="product-card reveal"
              style={{ "--reveal-delay": `${i * 110}ms` }}
              data-screen-label={`Product ${p.name}`}
            >
              <div className="pimg">
                <ImagePlaceholder id={`product-${PRODUCT_SLUGS[i]}`} alt={`${p.name} · ${p.variety}`} />
                <span className="region-badge"><span className="ddot" />{p.region}</span>
                <span className="idx">0{i + 1} / 06</span>
              </div>
              <div className="product-body">
                <span className="pvariety mono">{p.variety}</span>
                <h3 className="pname">{p.name}</h3>
                <p className="pnote">{p.note}</p>
                <SeasonCalendar
                  months={p.months}
                  monthLabels={P.months}
                  peakLabel={P.peakLegend}
                  activeLabel={P.activeLegend}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
