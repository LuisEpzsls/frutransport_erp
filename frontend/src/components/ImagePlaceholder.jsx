import { IMAGES } from "../lib/images.js";

export default function ImagePlaceholder({ id, alt, src: srcProp }) {
  const src = srcProp ?? IMAGES[id] ?? `/images/${id}.jpg`;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
