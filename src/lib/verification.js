import { sha256 } from "./metadata.js";

const labelPattern = /<syntag:DisclosureLabel>([^<]+)<\/syntag:DisclosureLabel>/i;
const levelPattern = /<syntag:DisclosureLevel>([^<]+)<\/syntag:DisclosureLevel>/i;

export async function inspectAsset(file, sidecarFile = null) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const label = text.match(labelPattern)?.[1] || "";
  const level = text.match(levelPattern)?.[1] || "";
  let sidecar = null;
  let sidecarError = "";
  if (sidecarFile) {
    try {
      sidecar = JSON.parse(await sidecarFile.text());
    } catch {
      sidecarError = "The sidecar is not valid JSON.";
    }
  }
  const sidecarMatches = sidecar?.source?.sha256
    ? sidecar.source.sha256 === await sha256(file)
    : null;
  return {
    filename: file.name,
    type: file.type || "unknown",
    size: file.size,
    sha256: await sha256(file),
    embedded: Boolean(label || level || text.includes("Syntag disclosure")),
    label,
    level,
    sidecar,
    sidecarError,
    sidecarMatches,
  };
}
