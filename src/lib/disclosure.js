import { LANGUAGES } from "./locales.js";

export const LEVELS = {
  involved: {
    label: "AI",
    eu: "basic",
    description: "Use when AI contributed to the asset.",
  },
  generated: {
    label: "AI GENERATED",
    eu: "generated",
    description: "Use when AI generated the entire asset.",
  },
  modified: {
    label: "AI MODIFIED",
    eu: "modified",
    description: "Use when AI materially changed existing human-made content.",
  },
};
export const DEFAULTS = Object.freeze({
  level: "generated",
  theme: "eu",
  position: "bottom-right",
  size: "medium",
  opacity: 1,
  sidecar: true,
  embedMetadata: true,
  euVariant: "auto",
  audioTone: true,
  language: "en",
});
export const POSITIONS = [
  "top-left",
  "top-right",
  "center",
  "bottom-left",
  "bottom-right",
];
export const THEMES = ["mono", "metal", "outline", "eu"];
export const SIZES = ["small", "medium", "large"];
export const EU_VARIANTS = ["auto", "black", "white", "black-50", "white-50"];

export function normalizeOptions(input = {}) {
  const o = { ...DEFAULTS, ...input };
  if (!LEVELS[o.level]) o.level = DEFAULTS.level;
  if (!THEMES.includes(o.theme)) o.theme = DEFAULTS.theme;
  if (!POSITIONS.includes(o.position)) o.position = DEFAULTS.position;
  if (!SIZES.includes(o.size)) o.size = DEFAULTS.size;
  if (!EU_VARIANTS.includes(o.euVariant)) o.euVariant = DEFAULTS.euVariant;
  o.opacity = Math.max(
    o.theme === "eu" ? 0.5 : 0.35,
    Math.min(1, Number(o.opacity) || 1),
  );
  o.sidecar = true;
  o.embedMetadata = o.embedMetadata !== false;
  o.audioTone = o.audioTone !== false;
  if (!LANGUAGES[o.language]) o.language = DEFAULTS.language;
  return o;
}

export function euAsset(level, variant = "black") {
  const suffix =
    variant === "white" || variant === "white-50" ? "white" : "black";
  return `/eu-${LEVELS[level]?.eu || "generated"}-${suffix}.svg`;
}

export function formatBytes(n) {
  return n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
}

export function kindOf(file) {
  if (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  )
    return "zip";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  )
    return "pdf";
  return null;
}

const LIMITS = {
  zip: 300 * 1024 ** 2,
  image: 80 * 1024 ** 2,
  video: 300 * 1024 ** 2,
  audio: 100 * 1024 ** 2,
  pdf: 100 * 1024 ** 2,
};
export function validateFile(file) {
  const kind = kindOf(file);
  if (!kind)
    throw new Error(
      "Unsupported file type. Choose an image, video, audio, PDF, or ZIP.",
    );
  if (file.size > LIMITS[kind])
    throw new Error(
      `${kind.toUpperCase()} exceeds the ${formatBytes(LIMITS[kind])} browser-processing limit.`,
    );
  return kind;
}
