const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

export function IconAgro() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 21V11" />
      <path d="M12 11c0-4 3-7 7-7-1 5-3 7-7 7Z" />
      <path d="M12 14c0-3-2-5-5-5 1 4 2 5 5 5Z" />
    </svg>
  );
}
export function IconImports() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="9" width="18" height="11" rx="1" />
      <path d="M3 13h18" />
      <path d="M12 3v6" />
      <path d="M9 6l3-3 3 3" />
    </svg>
  );
}
export function IconAuto() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 14l1.5-4a2 2 0 0 1 2-1.5h11a2 2 0 0 1 2 1.5L21 14" />
      <rect x="3" y="14" width="18" height="5" rx="1" />
      <circle cx="7.5" cy="19" r="1.4" />
      <circle cx="16.5" cy="19" r="1.4" />
    </svg>
  );
}
export function IconLogistics() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="7" width="11" height="9" rx="0.5" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7.5" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}
export function IconHeavy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 17V8h9v9" />
      <path d="M12 11h5l4 4v2h-9" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
      <path d="M15 6l2 2-2 2" />
    </svg>
  );
}
export function IconTelecom() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 17v3" />
      <circle cx="12" cy="13" r="1.4" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0" />
      <path d="M5.5 6.5a9 9 0 0 1 13 0" />
    </svg>
  );
}

export const DIV_ICONS = [IconAgro, IconImports, IconAuto, IconLogistics, IconHeavy, IconTelecom];

export function IconArrow({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  );
}
export function IconLock({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <rect x="3.5" y="7" width="9" height="6" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 1 1 5 0v2" />
    </svg>
  );
}
export function IconCorner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M5 11l6-6" />
      <path d="M6 5h5v5" />
    </svg>
  );
}
export function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
export function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
export function IconGlobe({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2c2 2 2 10 0 12c-2-2-2-10 0-12Z" />
    </svg>
  );
}
export function IconChev({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
export function IconPerson({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
    </svg>
  );
}
export function IconBell({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
export function IconSun({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
export function IconMoon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
export function IconUsers({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c.7-3 3-5 6.5-5s5.8 2 6.5 5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M16 13.2c2.6.3 4.3 2 4.9 4.3" />
    </svg>
  );
}
export function IconLayers({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
      <path d="M12 3l9 5-9 5-9-5 9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}
