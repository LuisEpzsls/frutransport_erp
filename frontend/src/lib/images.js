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
  // ── Hero tiles — deben coincidir con hero.vis (a=Mandarina, b=Palta, c=Arándano) ──
  "hero-a": img("mandarina.jpg"), // mandarina con hojas ✓
  "hero-b": img("palta.jpg"),     // palta hass partida ✓
  "hero-c": img("arandano.jpg"),  // arándanos en bowl ✓

  // ── Productos agroexportación — clave = slug estable, NO índice numérico.
  // El orden de products.list en strings.js (Mandarina, Palta, Arándano, Uva,
  // Mango, Espárrago) es el mismo en los 4 idiomas; ProductsGrid arma la
  // clave `product-<slug>` desde el mismo array de slugs, así que un futuro
  // reordenamiento de products.list no puede volver a desalinear las fotos
  // (la causa exacta del bug anterior, que usaba `product-${i}`).
  "product-mandarina": img("mandarina.jpg"),      // mandarina con hojas ✓
  "product-palta":     img("palta.jpg"),          // palta hass partida ✓
  "product-arandano":  img("arandano.jpg"),       // arándanos en bowl ✓
  "product-uva":       img("uva.jpg"),            // racimo de uva ✓
  "product-mango":     img("mango.jpg"),          // mango entero ✓
  "product-esparrago": img("esparrago-crudo.jpg"),// espárragos crudos, primer plano ✓

  // ── Heritage gallery — verificadas contra heritage.slots.*.caption ──
  "heritage-field":  img("heritage-field.jpg"),  // almácigo / campo de cultivo ✓
  "heritage-fruits": img("heritage-fruits.jpg"), // cosecha de mangos ✓
  // Valle alpino verde con nieve: proxy de "sierra peruana" (no es Perú
  // literalmente, es la mejor opción de paisaje de montaña verificada).
  "heritage-andes":  img("heritage-andes.jpg"),
  "heritage-market": img("heritage-market.jpg"), // puesto de mercado tradicional ✓
  "heritage-port":   img("heritage-port.jpg"),   // puerto de contenedores aéreo ✓
};
