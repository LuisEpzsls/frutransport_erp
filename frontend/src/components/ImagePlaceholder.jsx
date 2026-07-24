import { IMAGES } from "../lib/images.js";

// eager=true para contenido sobre el pliegue (el Hero, lo primero que se ve):
// "loading=lazy" ahí retrasa el LCP (Largest Contentful Paint) — el navegador
// puede posponer la descarga de una imagen marcada lazy incluso si es
// visible de entrada. El resto de la página (fuera del pliegue) sí debe
// seguir lazy por defecto.
export default function ImagePlaceholder({ id, alt, src: srcProp, eager }) {
  const src = srcProp ?? IMAGES[id] ?? `/images/${id}.jpg`;
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      {...(eager ? { fetchpriority: "high" } : {})}
      decoding="async"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
