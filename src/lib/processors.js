import { LEVELS, euAsset, kindOf, normalizeOptions } from "./disclosure.js";
import { makeMetadata } from "./metadata.js";

const sizeFactor = { small: 0.022, medium: 0.034, large: 0.05 };
const euCache = new Map();
const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
};
const canvasBlob = (canvas, type = "image/png", quality = 0.94) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create export"))),
      type,
      quality,
    ),
  );

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Label asset could not be loaded"));
    i.src = src;
  });
}
async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await loadImage(url);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

export async function getEuCanvas(level, color = "black") {
  const key = `${level}-${color}`;
  if (euCache.has(key)) return euCache.get(key);
  const img = await loadImage(euAsset(level, "black")),
    source = { x: 110, y: 590, w: 2280, h: 470 };
  const c = document.createElement("canvas");
  c.width = source.w;
  c.height = source.h;
  const x = c.getContext("2d");
  x.drawImage(
    img,
    source.x,
    source.y,
    source.w,
    source.h,
    0,
    0,
    c.width,
    c.height,
  );
  if (color === "white") {
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "source-over";
  }
  euCache.set(key, c);
  return c;
}

function positionFor(w, h, tw, th, o) {
  const m = Math.min(w, h) * 0.035;
  return {
    "top-left": [m, m],
    "top-right": [w - tw - m, m],
    center: [(w - tw) / 2, (h - th) / 2],
    "bottom-left": [m, h - th - m],
    "bottom-right": [w - tw - m, h - th - m],
  }[o.position];
}
function regionLuminance(ctx, x, y, w, h) {
  try {
    const d = ctx.getImageData(
      Math.max(0, x),
      Math.max(0, y),
      Math.max(1, Math.min(w, ctx.canvas.width - x)),
      Math.max(1, Math.min(h, ctx.canvas.height - y)),
    ).data;
    let total = 0,
      count = 0;
    for (
      let i = 0;
      i < d.length;
      i += Math.max(4, Math.floor(d.length / 1600 / 4) * 4)
    ) {
      total += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      count++;
    }
    return total / count;
  } catch {
    return 255;
  }
}

export async function drawTag(ctx, w, h, input = {}) {
  const o = normalizeOptions(input),
    fs = Math.max(13, Math.min(w, h) * (sizeFactor[o.size] || 0.034));
  if (o.theme === "eu") {
    const tw = fs * 8.5,
      th = tw / 4.85,
      [x, y] = positionFor(w, h, tw, th, o);
    let variant = o.euVariant;
    if (variant === "auto")
      variant = regionLuminance(ctx, x, y, tw, th) > 135 ? "black" : "white";
    const color = variant.startsWith("white") ? "white" : "black",
      eu = await getEuCanvas(o.level, color);
    ctx.save();
    ctx.globalAlpha = o.opacity * (variant.endsWith("-50") ? 0.5 : 1);
    ctx.drawImage(eu, x, y, tw, th);
    ctx.restore();
    return { x, y, width: tw, height: th, variant };
  }
  const text = LEVELS[o.level].label,
    pad = fs * 0.65,
    gap = fs * 0.35,
    iw = fs * 0.95;
  ctx.font = `700 ${fs}px Arial`;
  const tw = ctx.measureText(text).width + pad * 2 + iw + gap,
    th = fs + pad,
    [x, y] = positionFor(w, h, tw, th, o);
  ctx.save();
  ctx.globalAlpha = o.opacity;
  if (o.theme === "metal") {
    const g = ctx.createLinearGradient(x, y, x + tw, y + th);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.28, "#777");
    g.addColorStop(0.52, "#fff");
    g.addColorStop(0.78, "#555");
    g.addColorStop(1, "#eee");
    ctx.fillStyle = g;
  } else
    ctx.fillStyle = o.theme === "outline" ? "rgba(255,255,255,.88)" : "#000";
  ctx.strokeStyle = o.theme === "outline" ? "#000" : "transparent";
  ctx.lineWidth = Math.max(1, fs * 0.055);
  ctx.beginPath();
  ctx.roundRect(x, y, tw, th, th / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle =
    o.theme === "outline" || o.theme === "metal" ? "#000" : "#fff";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.strokeRect(x + pad * 0.65, y + (th - iw) / 2, iw, iw);
  ctx.font = `800 ${fs * 0.43}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("AI", x + pad * 0.65 + iw / 2, y + th / 2);
  ctx.font = `700 ${fs}px Arial`;
  ctx.textAlign = "left";
  ctx.fillText(text, x + pad * 0.65 + iw + gap, y + th / 2);
  ctx.restore();
  return { x, y, width: tw, height: th };
}

async function processImage(file, o, { signal, onProgress }) {
  throwIfAborted(signal);
  const img = await decodeImage(file),
    c = document.createElement("canvas");
  c.width = img.width || img.naturalWidth;
  c.height = img.height || img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  onProgress(0.45, "Applying disclosure");
  await drawTag(x, c.width, c.height, o);
  throwIfAborted(signal);
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  return {
    blob: await canvasBlob(c, type, 0.94),
    extension: type === "image/jpeg" ? "jpg" : "png",
  };
}

async function processVideo(file, o, { signal, onProgress }) {
  if (!window.MediaRecorder)
    throw new Error("Video export is not supported by this browser.");
  const url = URL.createObjectURL(file),
    v = document.createElement("video");
  v.src = url;
  v.preload = "auto";
  v.playsInline = true;
  await new Promise((res, rej) => {
    v.onloadedmetadata = res;
    v.onerror = () => rej(new Error("Video could not be decoded"));
  });
  const scale = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight)),
    c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  const x = c.getContext("2d", { alpha: false }),
    stream = c.captureStream(30);
  let audioContext;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(v),
      dest = audioContext.createMediaStreamDestination(),
      silent = audioContext.createGain();
    silent.gain.value = 0;
    source.connect(dest);
    source.connect(silent);
    silent.connect(audioContext.destination);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    onProgress(0.02, "Audio track could not be copied");
  }
  const mime =
      [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find(MediaRecorder.isTypeSupported) || "",
    chunks = [],
    rec = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined,
    );
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res, rej) => {
    rec.onstop = res;
    rec.onerror = (e) => rej(e.error || new Error("Video export failed"));
  });
  let raf = 0,
    busy = false;
  const draw = async () => {
    if (signal?.aborted) {
      v.pause();
      rec.stop();
      return;
    }
    if (v.readyState >= 2 && !busy) {
      busy = true;
      x.drawImage(v, 0, 0, c.width, c.height);
      await drawTag(x, c.width, c.height, o);
      busy = false;
      onProgress(
        Math.min(0.98, v.currentTime / v.duration),
        `Rendering ${Math.round((v.currentTime / v.duration) * 100)}%`,
      );
    }
    if (!v.ended && !signal?.aborted) raf = requestAnimationFrame(draw);
  };
  rec.start(500);
  await v.play();
  draw();
  await Promise.race([
    new Promise((res) => v.addEventListener("ended", res, { once: true })),
    new Promise((_, rej) =>
      signal?.addEventListener(
        "abort",
        () => rej(new DOMException("Export cancelled", "AbortError")),
        { once: true },
      ),
    ),
  ]);
  cancelAnimationFrame(raf);
  if (rec.state !== "inactive") rec.stop();
  await stopped;
  await audioContext?.close();
  URL.revokeObjectURL(url);
  throwIfAborted(signal);
  return {
    blob: new Blob(chunks, { type: mime || "video/webm" }),
    extension: "webm",
  };
}

async function processPdf(file, o, { signal, onProgress }) {
  const {PDFDocument,StandardFonts,rgb}=await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer()),
    font = await doc.embedFont(StandardFonts.HelveticaBold),
    pages = doc.getPages();
  let euPng = null;
  if (o.theme === "eu") {
    const color = o.euVariant.startsWith("white") ? "white" : "black",
      blob = await canvasBlob(await getEuCanvas(o.level, color));
    euPng = await doc.embedPng(await blob.arrayBuffer());
  }
  for (let i = 0; i < pages.length; i++) {
    throwIfAborted(signal);
    const page = pages[i],
      { width, height } = page.getSize(),
      fs = Math.max(8, Math.min(width, height) * (sizeFactor[o.size] || 0.034));
    if (o.theme === "eu") {
      const tw = fs * 8.5,
        th = tw / 4.85,
        [x, top] = positionFor(width, height, tw, th, o);
      page.drawImage(euPng, {
        x,
        y: height - top - th,
        width: tw,
        height: th,
        opacity: o.opacity * (o.euVariant.endsWith("-50") ? 0.5 : 1),
      });
    } else {
      const text = LEVELS[o.level].label,
        pad = fs * 0.65,
        gap = fs * 0.35,
        iw = fs * 0.95,
        tw = font.widthOfTextAtSize(text, fs) + pad * 2 + iw + gap,
        th = fs + pad,
        [x, top] = positionFor(width, height, tw, th, o),
        y = height - top - th,
        black = rgb(0, 0, 0),
        white = rgb(1, 1, 1),
        light = rgb(0.92, 0.92, 0.92),
        bg =
          o.theme === "outline" ? white : o.theme === "metal" ? light : black,
        fg = o.theme === "outline" || o.theme === "metal" ? black : white;
      page.drawRectangle({
        x,
        y,
        width: tw,
        height: th,
        color: bg,
        borderColor: o.theme === "outline" ? black : undefined,
        borderWidth: o.theme === "outline" ? 1 : 0,
        opacity: o.opacity,
      });
      page.drawText("AI", {
        x: x + pad * 0.7,
        y: y + th / 2 - fs * 0.17,
        size: fs * 0.43,
        font,
        color: fg,
        opacity: o.opacity,
      });
      page.drawText(text, {
        x: x + pad * 0.7 + iw + gap,
        y: y + th / 2 - fs * 0.34,
        size: fs,
        font,
        color: fg,
        opacity: o.opacity,
      });
    }
    onProgress(
      (i + 1) / pages.length,
      `Stamping page ${i + 1} of ${pages.length}`,
    );
  }
  return {
    blob: new Blob([await doc.save()], { type: "application/pdf" }),
    extension: "pdf",
  };
}

function encodeWav(buffer, o) {
  const sr = buffer.sampleRate,
    channels = Math.min(2, buffer.numberOfChannels),
    lead = o.audioTone ? Math.round(sr * 0.8) : 0,
    total = lead + buffer.length,
    align = channels * 2,
    dataSize = total * align,
    comment = `Syntag disclosure: ${LEVELS[o.level].label}; source=browser-local`,
    info = new TextEncoder().encode(comment + "\0"),
    pad = info.length % 2,
    infoSize = 4 + 8 + info.length + pad,
    riff = 4 + (8 + 16) + (8 + dataSize) + (8 + infoSize),
    ab = new ArrayBuffer(8 + riff),
    v = new DataView(ab),
    u = new Uint8Array(ab);
  let p = 0;
  const str = (s) => {
      for (const ch of s) u[p++] = ch.charCodeAt(0);
    },
    u32 = (n) => {
      v.setUint32(p, n, true);
      p += 4;
    },
    u16 = (n) => {
      v.setUint16(p, n, true);
      p += 2;
    };
  str("RIFF");
  u32(riff);
  str("WAVE");
  str("fmt ");
  u32(16);
  u16(1);
  u16(channels);
  u32(sr);
  u32(sr * align);
  u16(align);
  u16(16);
  str("data");
  u32(dataSize);
  for (let i = 0; i < total; i++)
    for (let ch = 0; ch < channels; ch++) {
      let s;
      if (i < lead) {
        const t = i / sr,
          env =
            Math.min(1, t / 0.04) * Math.max(0, Math.min(1, (0.8 - t) / 0.08)),
          f = t < 0.26 ? 880 : t < 0.52 ? 1174 : 1568;
        s = 0.12 * Math.sin(2 * Math.PI * f * t) * env;
      } else
        s = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1))[
          i - lead
        ];
      s = Math.max(-1, Math.min(1, s));
      v.setInt16(p, s < 0 ? s * 32768 : s * 32767, true);
      p += 2;
    }
  str("LIST");
  u32(infoSize);
  str("INFO");
  str("ICMT");
  u32(info.length);
  u.set(info, p);
  p += info.length;
  if (pad) u[p] = 0;
  return new Blob([ab], { type: "audio/wav" });
}
async function processAudio(file, o, { signal, onProgress }) {
  throwIfAborted(signal);
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await ac.decodeAudioData(await file.arrayBuffer());
  onProgress(0.55, "Writing disclosure metadata");
  throwIfAborted(signal);
  const blob = encodeWav(buffer, o);
  await ac.close();
  return { blob, extension: "wav" };
}

export async function processFile(file, input = {}, runtime = {}) {
  const options = normalizeOptions(input),
    kind = kindOf(file),
    ctx = {
      signal: runtime.signal,
      onProgress: runtime.onProgress || (() => {}),
    };
  if (!kind) throw new Error("Unsupported file type");
  ctx.onProgress(0.01, "Preparing local export");
  let output;
  if (kind === "image") output = await processImage(file, options, ctx);
  else if (kind === "video") output = await processVideo(file, options, ctx);
  else if (kind === "pdf") output = await processPdf(file, options, ctx);
  else output = await processAudio(file, options, ctx);
  ctx.onProgress(1, "Export ready");
  const metadata = await makeMetadata(file, options, output);
  return {
    ...output,
    options,
    metadata,
    source: file,
    sidecar: options.sidecar
      ? new Blob([JSON.stringify(metadata, null, 2)], {
          type: "application/json",
        })
      : null,
  };
}
