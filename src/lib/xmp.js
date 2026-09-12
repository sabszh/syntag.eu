const XMP_HEADER = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0");
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function buildXmp(metadata) {
  const label = metadata.disclosure.label;
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
      xmlns:syntag="https://syntag.eu/ns/1.0/"
      dc:format="${escapeXml(metadata.output.type)}"
      photoshop:Instructions="${escapeXml(label)}"
      xmp:CreatorTool="Syntag"
      xmp:MetadataDate="${escapeXml(metadata.createdAt)}"
      Iptc4xmpCore:CountryCode="EU">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">AI disclosure: ${escapeXml(label)}</rdf:li></rdf:Alt></dc:description>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Syntag disclosure</rdf:li></rdf:Alt></dc:title>
      <syntag:DisclosureLevel>${escapeXml(metadata.disclosure.level)}</syntag:DisclosureLevel>
      <syntag:DisclosureLabel>${escapeXml(label)}</syntag:DisclosureLabel>
      <syntag:DisclosureLanguage>${escapeXml(metadata.disclosure.language || "en")}</syntag:DisclosureLanguage>
      <syntag:Theme>${escapeXml(metadata.disclosure.theme)}</syntag:Theme>
      <syntag:Processing>${escapeXml(metadata.processing)}</syntag:Processing>
      <syntag:SourceSHA256>${escapeXml(metadata.source.sha256)}</syntag:SourceSHA256>
      <syntag:VisibleDisclosure>true</syntag:VisibleDisclosure>
      <syntag:C2PA>false</syntag:C2PA>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function u32(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  return concat(u32(data.length), typeBytes, data, u32(crc32(concat(typeBytes, data))));
}

function pngXmpChunk(xmp) {
  const keyword = new TextEncoder().encode("XML:com.adobe.xmp");
  return pngChunk("iTXt", concat(keyword, new Uint8Array([0, 0, 0, 0, 0]), new TextEncoder().encode(xmp)));
}

async function embedJpeg(blob, xmp) {
  const input = new Uint8Array(await blob.arrayBuffer());
  if (input[0] !== 0xff || input[1] !== 0xd8) return blob;
  const data = concat(XMP_HEADER, new TextEncoder().encode(xmp));
  const length = data.length + 2;
  if (length > 0xffff) throw new Error("Embedded metadata is too large for this JPEG.");
  const marker = concat(new Uint8Array([0xff, 0xe1, (length >> 8) & 255, length & 255]), data);
  return new Blob([input.slice(0, 2), marker, input.slice(2)], { type: "image/jpeg" });
}

async function embedPng(blob, xmp) {
  const input = new Uint8Array(await blob.arrayBuffer());
  if (!PNG_SIGNATURE.every((byte, index) => input[index] === byte)) return blob;
  let offset = 8;
  let endOfImage = input.length;
  while (offset + 12 <= input.length) {
    const length = new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(input.slice(offset + 4, offset + 8));
    if (type === "IEND") {
      endOfImage = offset;
      break;
    }
    offset += length + 12;
  }
  const chunk = pngXmpChunk(xmp);
  return new Blob([input.slice(0, endOfImage), chunk, input.slice(endOfImage)], { type: "image/png" });
}

export async function embedXmp(blob, metadata) {
  if (!metadata.provenance?.embeddedXmp) return blob;
  const xmp = buildXmp(metadata);
  if (blob.type === "image/jpeg") return embedJpeg(blob, xmp);
  if (blob.type === "image/png") return embedPng(blob, xmp);
  return blob;
}
