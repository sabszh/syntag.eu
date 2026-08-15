import { LEVELS } from "./disclosure.js";

export async function sha256(file) {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(d)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function makeMetadata(file, options, output) {
  return {
    $schema: "/syntag-disclosure.schema.json",
    schemaVersion: "0.3.0",
    createdAt: new Date().toISOString(),
    processing: "browser-local",
    source: {
      name: file.name,
      type: file.type,
      size: file.size,
      sha256: await sha256(file),
    },
    disclosure: { ...options, label: LEVELS[options.level].label },
    output: { type: output.blob.type, extension: output.extension },
    notice:
      options.theme === "eu"
        ? "EU icon use alone does not establish legal compliance."
        : undefined,
  };
}

export function stem(name) {
  return name.replace(/\.[^.]+$/, "");
}
export function downloadBlob(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function downloadResult(result) {
  const base = `${stem(result.source.name)}-syntag`;
  downloadBlob(result.blob, `${base}.${result.extension}`);
  if (result.sidecar)
    setTimeout(() => downloadBlob(result.sidecar, `${base}.syntag.json`), 180);
}
