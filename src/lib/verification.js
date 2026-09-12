import { sha256 } from "./metadata.js";

const labelPattern = /<syntag:DisclosureLabel>([^<]+)<\/syntag:DisclosureLabel>/i;
const levelPattern = /<syntag:DisclosureLevel>([^<]+)<\/syntag:DisclosureLevel>/i;
let c2paSdkPromise;

async function readC2pa(file) {
  try {
    c2paSdkPromise ||= (async () => {
      const [{ createC2pa }, { default: wasmSrc }] = await Promise.all([
        import("@contentauth/c2pa-web"),
        import("@contentauth/c2pa-web/resources/c2pa.wasm?url"),
      ]);
      return createC2pa({ wasmSrc });
    })();
    const sdk = await c2paSdkPromise;
    const reader = await sdk.reader.fromBlob(file.type, file);
    if (!reader) return { present: false, valid: null };
    try {
      const store = await reader.manifestStore();
      const statuses = store.validation_status || [];
      return {
        present: true,
        valid: statuses.length === 0,
        activeLabel: await reader.activeLabel(),
      };
    } finally {
      await reader.free();
    }
  } catch {
    return { present: false, valid: null };
  }
}

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
  const c2pa = await readC2pa(file);
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
    c2pa,
  };
}
