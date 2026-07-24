// Imágenes servidas localmente desde /public/images/ (NO hotlinks a Unsplash).
//
// Motivo: la versión anterior enlazaba directo a images.unsplash.com y casi
// ninguna coincidía con su título (trigo en la tarjeta de "Espárrago", aurora
// boreal en "Andes", un puerto de contenedores etiquetado "Arándano", dos
// enlaces ya devolviendo 404). Al corregirlas, UNA de las fotos verificadas
// dejó de responder (404) minutos después de confirmarla — evidencia de que
// depender de hotlinks externos es fràgil para una demo de sustentación.
// Por eso cada imagen final se descargó una sola vez y vive en el repo:
// no hay dependencia de red ni riesgo de que Unsplash la mueva o la borre.
//
// Cada archivo fue verificado visualmente (no solo por el nombre del ID)
// antes de asignarlo.
const img = (name) => `/images/${name}`;

export const IMAGES = {
  // ── Hero tiles — deben coincidir con hero.vis (a=Mandarina, b=Palta,
  // c=puerto/contenedores — antes era un 3er fruto ficticio no exportado
  // realmente; ahora representa el embarque, coherente con los 2 productos
  // reales del catálogo) ──
  "hero-a": img("mandarina.jpg"),    // mandarina con hojas ✓
  "hero-b": img("palta.jpg"),        // palta hass partida ✓
  "hero-c": img("heritage-port.jpg"), // puerto de contenedores aéreo ✓

  // ── Productos agroexportación — clave = slug estable, NO índice numérico.
  // products.list en strings.js tiene solo 2 productos reales verificados
  // (Mandarina, Palta — Veritrade, RUC 20609731045), mismo orden en los 4
  // idiomas; ProductsGrid arma la clave `product-<slug>` desde ese mismo
  // array de slugs, así que un futuro reordenamiento de products.list no
  // puede volver a desalinear las fotos (la causa exacta del bug anterior,
  // que usaba `product-${i}`). Las demás quedan sin usar por ahora (no se
  // eliminan por si se recupera evidencia real de esos productos).
  "product-mandarina": img("mandarina.jpg"),      // mandarina con hojas ✓
  "product-palta":     img("palta.jpg"),          // palta hass partida ✓
  "product-arandano":  img("arandano.jpg"),       // sin usar — sin producto real verificado
  "product-uva":       img("uva.jpg"),            // sin usar — sin producto real verificado
  "product-mango":     img("mango.jpg"),          // sin usar — sin producto real verificado
  "product-esparrago": img("esparrago-crudo.jpg"),// sin usar — sin producto real verificado

  // ── Heritage gallery — verificadas contra heritage.slots.*.caption ──
  "heritage-field":  img("heritage-field.jpg"),  // almácigo / campo de cultivo ✓
  "heritage-fruits": img("heritage-fruits.jpg"), // cosecha de mangos ✓
  // Valle alpino verde con nieve: proxy de "sierra peruana" (no es Perú
  // literalmente, es la mejor opción de paisaje de montaña verificada).
  "heritage-andes":  img("heritage-andes.jpg"),
  "heritage-market": img("heritage-market.jpg"), // puesto de mercado tradicional ✓
  "heritage-port":   img("heritage-port.jpg"),   // puerto de contenedores aéreo ✓
};
