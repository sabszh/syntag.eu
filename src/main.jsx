import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { zipSync } from "fflate";
import "./styles.css";
import {
  DEFAULTS as defaults,
  LEVELS,
  euAsset,
  formatBytes,
  kindOf,
  validateFile,
} from "./lib/disclosure.js";
import { processFile, drawTag } from "./lib/processors.js";
import { downloadBlob, downloadResult } from "./lib/metadata.js";
import { installBrowserApi } from "./lib/api.js";

const labels = Object.fromEntries(
  Object.entries(LEVELS).map(([key, value]) => [key, value.label]),
);
let activeStudioFile = null;
function track(event, details = {}) {
  if (navigator.doNotTrack === "1") return;
  const payload = JSON.stringify({ event, route: location.hash.replace("#/", "") || "studio", ...details });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/usage", new Blob([payload], { type: "application/json" }));
  else fetch("/api/usage", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}
const pages = [
  ["studio", "Studio"],
  ["batch", "Batch"],
  ["guidance", "Guidance"],
  ["convention", "Convention"],
  ["developers", "Developers"],
  ["trust", "Trust"],
  ["contact", "Contact"],
];

function Logo({ size = 32 }) {
  return (
    <img
      className="logo"
      width={size}
      height={size}
      src="/syntag-logo.svg"
      alt="Syntag"
    />
  );
}
function Icon({ name }) {
  const p = {
    upload: "M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5",
    shield: "M12 3l7 3v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3z",
    download: "M12 4v11m0 0 5-5m-5 5-5-5M5 20h14",
    copy: "M8 8h11v11H8zM5 16H4V4h12v1",
    check: "M5 12.5l4.2 4.2L19 7",
    chevron: "M8 10l4 4 4-4",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={p[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function FormatIcon({ type }) {
  const paths = {
    image: "M4 5h16v14H4zM7 15l3-3 2 2 2-2 3 3M8 9h.01",
    video: "M4 6h11v12H4zM15 10l5-3v10l-5-3z",
    audio: "M6 10v4M10 7v10M14 4v16M18 9v6",
    pdf: "M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 16h6",
  };
  return <svg className="format-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}

function App() {
  const routeFromHash = () => {
    const value = location.hash.replace("#/", "");
    return pages.some(([id]) => id === value) ? value : "studio";
  };
  const [route, setRoute] = useState(routeFromHash());
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);
  useEffect(() => {
    const f = () => { setRoute(routeFromHash()); setMenuOpen(false); };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const go = (p) => { setMenuOpen(false); location.hash = `/${p}`; };
  useEffect(() => installBrowserApi(() => activeStudioFile), []);
  useEffect(() => { track("page_view"); }, [route]);
  useEffect(() => mainRef.current?.focus(), [route]);
  return (
    <div className="app">
      <header className="topbar" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          event.currentTarget.querySelector(".menu-toggle")?.focus();
        }
      }}>
        <button className="wordmark" onClick={() => go("studio")}>
          <Logo />
          <span>Syntag</span>
        </button>
        <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? "Close" : "Menu"}<Icon name="chevron" />
        </button>
        <nav id="site-navigation" aria-label="Main navigation" className={menuOpen ? "is-open" : ""}>
          {pages.map(([id, label]) => (
            <button
              key={id}
              className={route === id ? "active" : ""}
              onClick={() => go(id)}
              aria-current={route === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main key={route} className="route" tabIndex="-1" ref={mainRef}>
        {route === "studio" ? (
          <Studio />
        ) : route === "batch" ? (
          <Batch />
        ) : route === "guidance" ? (
          <Guidance />
        ) : route === "convention" ? (
          <Convention />
        ) : route === "developers" ? (
          <Developers />
        ) : route === "contact" ? (
          <Contact />
        ) : (
          <Trust />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Syntag — Disclose AI. Keep creativity open.</span>
      <span className="site-footer-credit">
        <img src="/eu-basic-black.svg" alt="EU AI involved" />
        <span>AI involved in the making of this site.</span>
      </span>
    </footer>
  );
}

function DecisionAssistant() {
  const [answers, setAnswers] = useState({ aiUsed: null, realistic: null, publicInterest: null, humanReview: null });
  const setAnswer = (key, value) => setAnswers((current) => ({ ...current, [key]: value }));
  const reset = () => setAnswers({ aiUsed: null, realistic: null, publicInterest: null, humanReview: null });
  const result = answers.aiUsed === "no"
    ? { tone: "optional", title: "No AI disclosure selected", body: "If no AI was used, Syntag does not need to add an AI label." }
    : answers.aiUsed === "yes" && (answers.realistic === "yes" || answers.publicInterest === "yes")
      ? { tone: "required", title: "Disclosure likely required", body: "The content may fall into a higher-risk disclosure context. Check the rules that apply to your publication before relying on this result." }
      : answers.aiUsed === "yes" && answers.humanReview === "yes"
        ? { tone: "recommended", title: "Disclosure recommended", body: "Human review matters, but it does not by itself remove the need to disclose AI involvement." }
        : answers.aiUsed === "yes"
          ? { tone: "recommended", title: "Disclosure recommended", body: "If AI materially contributed, a visible label is the safer publishing choice." }
          : null;
  const options = (key, values) => (
    <div className="decision-options" role="group" aria-label={key}>
      {values.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={answers[key] === value} className={answers[key] === value ? "selected" : ""} onClick={() => setAnswer(key, value)}>{label}</button>
      ))}
    </div>
  );
  return (
    <section className="decision-assistant" aria-labelledby="decision-title">
      <div className="decision-heading">
        <div><h3 id="decision-title">Do I need to label this?</h3></div>
        <button className="decision-reset" type="button" onClick={reset} disabled={!Object.values(answers).some(Boolean)}>Reset</button>
      </div>
      <p className="decision-intro">A quick publishing check. It is guidance, not legal advice.</p>
      <div className="decision-question"><strong>Was AI used in making or changing it?</strong>{options("aiUsed", [["yes", "Yes"], ["no", "No"]])}</div>
      {answers.aiUsed === "yes" && <>
        <div className="decision-question"><strong>Does it resemble a real person, place, object, or event?</strong>{options("realistic", [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]])}</div>
        <div className="decision-question"><strong>Is it published text or media about a matter of public interest?</strong>{options("publicInterest", [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]])}</div>
        <div className="decision-question"><strong>Was there meaningful human editorial review?</strong>{options("humanReview", [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]])}</div>
      </>}
      {result && <div className={`decision-result ${result.tone}`} role="status"><strong>{result.title}</strong><span>{result.body}</span></div>}
    </section>
  );
}

function Guidance() {
  return (
    <Page
      title="Should this be labelled?"
      intro="A short publishing check for deciding when an AI disclosure is the sensible next step."
    >
      <div className="guidance-layout">
        <DecisionAssistant />
        <aside className="guidance-notes">
          <h2>Make the call before you publish.</h2>
          <p>
            The questions look at how AI was used, what the content appears to
            show, and where it will be published. They are deliberately quick:
            use the result to start a review, not to replace one.
          </p>
          <p>
            If you are unsure, keep the disclosure. A clear label gives people
            useful context when the asset leaves Syntag and is reshared.
          </p>
          <a className="text-link" href="#/convention">See the disclosure levels <span>↗</span></a>
        </aside>
      </div>
    </Page>
  );
}

function Batch() {
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [opts, setOpts] = useState(defaults);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");

  function addFiles(selected) {
    const next = [...selected].filter((file) => {
      try { validateFile(file); return true; }
      catch (error) { setNotice(error.message); return false; }
    });
    setFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...next.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`))];
    });
    setResults([]);
    if (next.length) setNotice(`${next.length} file${next.length === 1 ? "" : "s"} ready to process.`);
  }

  async function exportBatch() {
    if (!files.length || processing) return;
    setProcessing(true);
    setProgress(0);
    setResults([]);
    const entries = {};
    const usedNames = new Set();
    const completed = [];
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setNotice(`Processing ${index + 1} of ${files.length}: ${file.name}`);
        const result = await processFile(file, opts, {
          onProgress: (value) => setProgress((index + value) / files.length),
        });
        const base = `${result.source.name.replace(/\.[^.]+$/, "")}-syntag`;
        let name = `${base}.${result.extension}`;
        let suffix = 2;
        while (usedNames.has(name)) name = `${base}-${suffix++}.${result.extension}`;
        usedNames.add(name);
        entries[name] = new Uint8Array(await result.blob.arrayBuffer());
        if (result.sidecar) entries[`${name}.syntag.json`] = new Uint8Array(await result.sidecar.arrayBuffer());
        completed.push({ name: file.name, output: name });
        setResults([...completed]);
      }
      const archive = zipSync(entries, { level: 6 });
      downloadBlob(new Blob([archive], { type: "application/zip" }), "syntag-batch.zip");
      track("batch_export_completed", { count: files.length });
      setNotice(`${files.length} file${files.length === 1 ? "" : "s"} exported as syntag-batch.zip`);
    } catch (error) {
      setNotice(error.message || "Batch export failed");
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }

  return (
    <Page
      title="Tag a whole folder."
      intro="Process several assets in your browser and download one ZIP. The files stay on your device."
    >
      <div className="batch-layout">
        <section className="batch-picker">
          <input ref={input} hidden type="file" multiple accept="image/*,video/*,audio/*,.pdf"
            onChange={(event) => { addFiles([...event.target.files]); event.target.value = ""; }} />
          <button className="batch-drop" type="button" onClick={() => input.current?.click()}>
            <Icon name="upload" />
            <strong>{files.length ? "Add more files" : "Choose files"}</strong>
            <span>Images, video, audio and PDF</span>
          </button>
          {files.length > 0 && <div className="batch-list" aria-live="polite">
            {files.map((file, index) => <div className="batch-row" key={`${file.name}-${file.lastModified}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{file.name}</strong>
              <small>{kindOf(file).toUpperCase()} · {formatBytes(file.size)}</small>
              {results[index] && <em>Ready</em>}
              {!processing && <button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setFiles(files.filter((_, i) => i !== index)); setResults([]); }}>×</button>}
            </div>)}
          </div>}
        </section>
        <aside className="batch-settings">
          <Head title="Batch settings" />
          <Control label="Label"><div className="choices disclosure-buttons" role="group" aria-label="Batch disclosure label">
            {Object.entries(LEVELS).map(([value, item]) => <button key={value} type="button" className={opts.level === value ? "selected" : ""} aria-pressed={opts.level === value} onClick={() => setOpts({ ...opts, level: value })}>{item.label.replace("AI ", "").toLowerCase()}</button>)}
          </div></Control>
          <Control label="Theme"><div className="choices" role="group" aria-label="Batch theme">
            {["eu", "mono", "metal", "outline"].map((value) => <button key={value} type="button" className={opts.theme === value ? "selected" : ""} aria-pressed={opts.theme === value} onClick={() => setOpts({ ...opts, theme: value })}>{value}</button>)}
          </div></Control>
          <label className="sidecar batch-sidecar"><span><strong>Sidecar JSON</strong><small>Include a disclosure record for each file</small></span><input type="checkbox" checked={opts.sidecar} onChange={(event) => setOpts({ ...opts, sidecar: event.target.checked })} /><i /></label>
          {progress > 0 && <progress className="export-progress" aria-label="Batch export progress" max="1" value={progress}>{Math.round(progress * 100)}%</progress>}
          <button className="export" type="button" disabled={!files.length || processing} onClick={exportBatch}><Icon name="download" /><span>{processing ? "Processing…" : "Export ZIP"}</span></button>
          <p className="batch-notice" role="status">{notice}</p>
        </aside>
      </div>
    </Page>
  );
}

function Studio() {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [opts, setOpts] = useState(defaults);
  const [notice, setNotice] = useState({ text: "", tone: "idle" });
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [controller, setController] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const kind = useMemo(() => (file ? kindOf(file) : ""), [file]);
  async function choose(f) {
    if (!f) return;
    try {
      validateFile(f);
    } catch (error) {
      setNotice({ text: error.message, tone: "error" });
      return;
    }
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    activeStudioFile = f;
    track("file_selected", { kind: kindOf(f) });
    setVideoReady(false);
    setUrl(URL.createObjectURL(f));
    setNotice({ text: "Ready to export", tone: "ready" });
  }
  function update(k, v) {
    setVideoReady(true);
    setOpts((o) => ({ ...o, [k]: v }));
  }
  async function exportAsset() {
    if (!file || exporting) return;
    const abortController = new AbortController();
    setController(abortController);
    setExporting(true);
    setProgress(0.01);
    setNotice({ text: "Preparing export", tone: "working" });
    try {
      const result = await processFile(file, opts, {
        signal: abortController.signal,
        onProgress: (value, message) => {
          setProgress(value);
          message && setNotice({ text: message, tone: "working" });
        },
      });
      downloadResult(result);
      track("export_completed", { kind });
      setNotice({ text: "Export complete", tone: "success" });
    } catch (e) {
      setNotice({
        text:
          e.name === "AbortError"
            ? "Export cancelled"
            : e.message || "Export failed",
        tone: e.name === "AbortError" ? "idle" : "error",
      });
    } finally {
      setExporting(false);
      setController(null);
      setTimeout(() => setProgress(0), 900);
    }
  }
  return (
    <section className="studio-page">
      <div className="page-intro">
        <div>
          <h1>Upload. Tag. Export.</h1>
          <p>
            Add an AI disclosure in your browser. Your file is not uploaded.
          </p>
        </div>
      </div>
      <div className="workbench">
        <section className="canvas-wrap">
          <input ref={input} hidden type="file" accept="image/*,video/*,audio/*,.pdf"
            onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
          <div className={`canvas ${kind || ""} ${file ? "has-file" : ""} ${dragging ? "is-dragging" : ""}`}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!exporting) choose(e.dataTransfer.files[0]); }}>
            {!file && (
              <button className="empty upload-area" onClick={() => input.current?.click()}>
                <span className="upload-icon"><Icon name="upload" /></span>
                <h3>A little transparency starts here.</h3>
                <p><span className="upload-desktop-hint">Drop your file here, or </span><span>browse files</span></p>
                <small className="file-types">Image · Video · Audio · PDF</small>
              </button>
            )}
            {file && <Preview file={file} url={url} opts={opts} videoReady={videoReady} />}
          </div>
          <div className="preview-caption">
            <div>
              <strong>{file ? file.name : "Your file stays yours."}</strong>
              <small>{file ? `${kind.toUpperCase()} · ${formatBytes(file.size)}` : "Private. Local. In your browser."}</small>
            </div>
            {file && <div className="file-actions">
              <button disabled={exporting} onClick={() => input.current?.click()}>Replace file</button>
              <button disabled={exporting} onClick={() => {
                setFile(null); activeStudioFile = null; setUrl(""); setVideoReady(false); setNotice({ text: "", tone: "idle" });
              }}>Remove</button>
            </div>}
          </div>
        </section>
        <aside className="inspector">
          <Head
            title="Disclosure"
            action={
              <button
                className="reset"
                onClick={() => setOpts(defaults)}
                disabled={JSON.stringify(opts) === JSON.stringify(defaults)}
              >
                Reset
              </button>
            }
          />
          <Control label="Label">
            <div className="choices disclosure-buttons" role="group" aria-label="Disclosure label">
              {Object.entries(LEVELS).map(([value, item]) => (
                <button key={value} aria-pressed={opts.level === value}
                  className={opts.level === value ? "selected" : ""}
                  onClick={() => { update("level", value); track("label_selected", { kind: value }); }}>{item.label.replace("AI ", "").toLowerCase()}</button>
              ))}
            </div>
            <p className="label-help">{LEVELS[opts.level].description}</p>
          </Control>
          <Control label="Theme">
            <div className="theme-gallery" role="group" aria-label="Disclosure theme">
              {[
                ["eu", "EU icon"],
                ["mono", "Black"],
                ["metal", "Metal"],
                ["outline", "Outline"],
              ].map(([value, name]) => (
                <button
                  key={value}
                  type="button"
                  className={`theme-card ${opts.theme === value ? "selected" : ""}`}
                  aria-label={name}
                  aria-pressed={opts.theme === value}
                  onClick={() => update("theme", value)}
                >
                  <span className="theme-preview">
                    <Tag opts={{ ...opts, theme: value, position: "sample", size: "small" }} />
                  </span>
                  <small>{name}</small>
                </button>
              ))}
            </div>
          </Control>
          <Control label="Size">
            <div className="choices">
              {["small", "medium", "large"].map((v) => (
                <button
                  key={v}
                  className={opts.size === v ? "selected" : ""}
                  onClick={() => update("size", v)}
                  aria-pressed={opts.size === v}
                >
                  {v}
                </button>
              ))}
            </div>
          </Control>
          <div className="advanced visible-settings">
            {opts.theme === "eu" && (
              <Control label="EU contrast">
                <select
                  value={opts.euVariant}
                  onChange={(e) => update("euVariant", e.target.value)}
                >
                  <option value="auto">Automatic</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                  <option value="black-50">Black 50%</option>
                  <option value="white-50">White 50%</option>
                </select>
              </Control>
            )}
            <Control label="Position">
              <div className="position-grid">
                {[
                  "top-left",
                  "top-right",
                  "center",
                  "bottom-left",
                  "bottom-right",
                ].map((v) => (
                  <button
                    aria-label={v.replaceAll("-", " ")}
                    aria-pressed={opts.position === v}
                    key={v}
                    className={opts.position === v ? "selected" : ""}
                    onClick={() => update("position", v)}
                  >
                    <i />
                  </button>
                ))}
              </div>
            </Control>
            <Control label={`Opacity ${Math.round(opts.opacity * 100)}%`}>
              <input
                type="range"
                min="35"
                max="100"
                value={opts.opacity * 100}
                onChange={(e) => update("opacity", e.target.value / 100)}
              />
            </Control>
            {kind === "audio" && (
              <label className="sidecar">
                <span>
                  <strong>Audio signal</strong>
                  <small>Add a three-note disclosure tone</small>
                </span>
                <input
                  type="checkbox"
                  checked={opts.audioTone}
                  onChange={(e) => update("audioTone", e.target.checked)}
                />
                <i />
              </label>
            )}
            {kind === "image" && (
              <label className="sidecar">
                <span>
                  <strong>Embedded metadata</strong>
                  <small>Add XMP/IPTC-compatible disclosure data to the image</small>
                </span>
                <input
                  type="checkbox"
                  checked={opts.embedMetadata}
                  onChange={(e) => update("embedMetadata", e.target.checked)}
                />
                <i />
              </label>
            )}
          </div>
          {progress > 0 && (
            <progress className="export-progress" aria-label="Export progress" max="1" value={progress}>
              {Math.round(progress * 100)}%
            </progress>
          )}
          <button
            className="export"
            disabled={!file || exporting}
            onClick={exportAsset}
          >
            <Icon name="download" />
            <span>
              {exporting
                ? "Processing…"
                : file
                  ? "Export asset"
                  : "Select a file"}
            </span>
          </button>
          {exporting && (
            <button className="cancel" onClick={() => controller?.abort()}>
              Cancel export
            </button>
          )}
          <div className={`status ${notice.tone}`} role="status">
            {notice.tone === "success" && <Icon name="check" />}
            <span>{notice.text}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Head({ title, action }) {
  return (
    <div className="rail-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
function Preview({ file, url, opts, videoReady }) {
  const canvas = useRef(null);
  const [error, setError] = useState("");
  const [pdfPreview, setPdfPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      try {
        const buffer = document.createElement("canvas");
        buffer.width = img.naturalWidth;
        buffer.height = img.naturalHeight;
        const ctx = buffer.getContext("2d");
        ctx.drawImage(img, 0, 0);
        await drawTag(ctx, buffer.width, buffer.height, opts);
        if (cancelled || !canvas.current) return;
        canvas.current.width = buffer.width;
        canvas.current.height = buffer.height;
        canvas.current.getContext("2d").drawImage(buffer, 0, 0);
        setError("");
      } catch (e) { if (!cancelled) setError(e.message); }
    };
    img.onerror = () => { if (!cancelled) setError("This image could not be previewed."); };
    img.src = url;
    return () => { cancelled = true; };
  }, [file, url, opts]);
  useEffect(() => {
    if (kindOf(file) !== "pdf") return undefined;
    let cancelled = false;
    let nextUrl = "";
    processFile(file, { ...opts, sidecar: false })
      .then((result) => {
        if (cancelled) return;
        nextUrl = URL.createObjectURL(result.blob);
        setPdfPreview(nextUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "This PDF could not be previewed.");
      });
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [file, opts]);
  useEffect(() => {
    if (!file.type.startsWith("video/") || !videoReady) return undefined;
    let cancelled = false;
    let nextUrl = "";
    const controller = new AbortController();
    processFile(file, { ...opts, sidecar: false }, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        nextUrl = URL.createObjectURL(result.blob);
        setVideoPreview(nextUrl);
      })
      .catch((e) => {
        if (!cancelled && e.name !== "AbortError") setError(e.message || "This video could not be previewed.");
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [file, opts, videoReady]);
  if (file.type.startsWith("image/"))
    return <>{error ? <p role="alert">{error}</p> : <canvas ref={canvas} className="image-preview" role="img" aria-label={`Asset preview with ${labels[opts.level]}`} />}</>;
  if (file.type.startsWith("video/")) {
    if (!videoReady) return <div className="video-gate"><span className="video-gate-icon">▶</span><strong>Choose a disclosure to load the video</strong><small>Select a label or theme in the panel.</small></div>;
    return videoPreview ? (
      <video src={videoPreview} controls />
    ) : <p className="preview-loading">Rendering disclosure preview…</p>;
  }
  if (file.type.startsWith("audio/")) {
    return (
      <div className="audio-preview">
        <Tag opts={{ ...opts, position: "sample", size: "medium" }} />
        <audio src={url} controls />
        <small>Disclosure is stored in the exported audio metadata.</small>
      </div>
    );
  }
  if (kindOf(file) === "pdf") {
    if (error) return <p role="alert">{error}</p>;
    return pdfPreview ? (
      <embed src={`${pdfPreview}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" title="PDF asset preview with disclosure" />
    ) : <p className="preview-loading">Rendering disclosure preview…</p>;
  }
  return <embed src={url} type="application/pdf" title="PDF asset preview" />;
}
function Tag({ opts }) {
  if (opts.theme === "eu") {
    return (
      <div
        className={`tag eu ${opts.size} ${opts.position} eu-${opts.euVariant}`}
        style={{ opacity: opts.opacity }}
        role="img"
        aria-label={`EU icon: ${labels[opts.level]}`}
      >
        <img
          src={euAsset(
            opts.level,
            opts.euVariant.startsWith("white") ? "white" : "black",
          )}
          alt=""
        />
      </div>
    );
  }
  return (
    <div
      className={`tag ${opts.theme} ${opts.size} ${opts.position}`}
      style={{ opacity: opts.opacity }}
    >
      <span className="ai-glyph">AI</span>
      <b>{labels[opts.level]}</b>
    </div>
  );
}
function Control({ label, children }) {
  const id = useId();
  return (
    <div className="control">
      <label htmlFor={id}>{label}</label>
      {React.isValidElement(children) &&
      ["select", "input"].includes(children.type)
        ? React.cloneElement(children, { id })
        : children}
    </div>
  );
}
function Convention() {
  return (
    <Page
      title="Disclosure levels"
      intro="Syntag uses three labels: AI involved, AI generated, and AI modified."
    >
      <div className="cards">
        {Object.keys(labels).map((k, i) => (
          <article key={k}>
            <span>0{i + 1}</span>
            <Tag
              opts={{
                ...defaults,
                level: k,
                theme: "mono",
                position: "sample",
                size: "medium",
              }}
            />
            <p>
              {k === "involved"
                ? "Use when AI contributed to the asset."
                : k === "generated"
                  ? "Use when AI generated the entire asset."
                  : "Use when AI materially changed existing human-made content."}
            </p>
          </article>
        ))}
      </div>
      <section className="eu-callout">
        <h2>EU icon mapping</h2>
        <p>
          The EU set is a shared visual language for content that has been
          generated or manipulated with AI. Syntag maps its three labels to the
          official icons so a disclosure remains recognisable after an asset is
          downloaded or reshared. The icons are optional and do not by
          themselves prove legal compliance.
        </p>
      </section>
      <div className="mapping-notes">
        <div><strong>AI involved</strong><span>Basic icon for work where AI contributed.</span></div>
        <div><strong>AI generated</strong><span>Fully generated icon for content made entirely by AI.</span></div>
        <div><strong>AI modified</strong><span>Partially modified icon for human content changed with AI.</span></div>
      </div>
    </Page>
  );
}
function Developers() {
  return (
    <Page
      title="Browser API, Local MCP & API"
      intro="Choose browser-local or desktop-local integration. Asset bytes stay on the user’s device."
    >
      <nav className="developer-links" aria-label="Developer resources">
        <a href="https://github.com/sabszh/syntag.eu" target="_blank" rel="noreferrer">
          <span>Source code</span>
          <strong>GitHub ↗</strong>
        </a>
        <a href="https://www.npmjs.com/package/@sabszh/syntag-local" target="_blank" rel="noreferrer">
          <span>Install the local CLI</span>
          <strong>npm ↗</strong>
        </a>
      </nav>
      <div className="code-grid">
        <Code
          title="Browser API"
          code={`const result = await Syntag.process(file, {\n  level: "generated",\n  theme: "eu",\n  euVariant: "auto",\n  position: "bottom-right",\n  size: "medium",\n  opacity: 1,\n  sidecar: true,\n  audioTone: true\n});`}
        />
        <Code
          title="MCP tool"
          code={`{\n  "name": "syntag_tag_asset",\n  "arguments": {\n    "settings": {\n      "level": "generated",\n      "theme": "eu",\n      "euVariant": "auto",\n      "position": "bottom-right",\n      "size": "medium",\n      "opacity": 1,\n      "sidecar": true\n    }\n  }\n}`}
        />
      </div>
      <div className="code-grid local-integration-grid">
        <Code
          title="Local MCP"
          code={`npm run local:mcp\n\n// MCP client config\n{\n  "command": "npm",\n  "args": ["run", "local:mcp"]\n}`}
        />
        <Code
          title="Local HTTP API"
          code={`POST http://127.0.0.1:4317/v1/tag\n\n{\n  "filename": "image.png",\n  "assetBase64": "...",\n  "settings": {\n    "level": "generated",\n    "theme": "eu"\n  }\n}`}
        />
      </div>
      <section className="developer-explainer">
        <div className="developer-explainer-intro">
          <h2>Choose the route that keeps your file where it already is.</h2>
          <p>
            Syntag can tag a browser file, a file on your computer, or image
            data sent to a loopback service. The label settings stay the same;
            only the handoff changes.
          </p>
        </div>
        <div className="developer-flow">
          <article>
            <span className="flow-number">01</span>
            <h3>Browser API</h3>
            <p>
              Your web app passes a browser <code>File</code> object to
              <code> Syntag.process()</code>. The browser creates a new tagged
              file and local metadata; no file upload is needed.
            </p>
          </article>
          <article>
            <span className="flow-number">02</span>
            <h3>Local MCP</h3>
            <p>
              A desktop AI client launches <code>local:mcp</code> as a child
              process. The MCP tool receives a local path and settings, then
              writes the tagged image beside the source file.
            </p>
          </article>
          <article>
            <span className="flow-number">03</span>
            <h3>Local HTTP API</h3>
            <p>
              A script or creative application posts an image to
              <code>127.0.0.1:4317</code>. The local service returns the tagged
              asset; the endpoint is not hosted on or routed through Syntag.
            </p>
          </article>
        </div>
        <div className="developer-note">
          <strong>What developers need to remember</strong>
          <span>
            The browser bridge on this page is a demonstration of the MCP
            contract. It uses the selected browser file. The local MCP and API
            processes are for desktop automation and currently support images.
            PNG and JPEG exports can also carry XMP/IPTC-compatible disclosure
            metadata. That metadata is portable but not cryptographically
            signed C2PA provenance. None of these local workflows require a
            Syntag account or a public server endpoint.
          </span>
        </div>
      </section>
      <RpcConsole />
      <p className="footnote">
        The browser bridge is the working integration: it calls the same
        processor as Studio and keeps the selected file in the browser session.
        For desktop automation, the repository also includes an opt-in local
        MCP/API companion (`npm run local:mcp` or `npm run local:api`) that
        processes image files on the user’s device and never contacts a Syntag
        server. The local companion currently supports images.
      </p>
    </Page>
  );
}
function Trust() {
  return (
    <Page
      title="Privacy"
      intro="Files are processed in the browser and are not sent to a Syntag server."
    >
      <div className="trust-grid">
        <article>
          <Icon name="shield" />
          <h3>Local processing</h3>
          <p>
            Preview and export run in browser APIs. The original file is read
            into memory, processed locally, and released when the session ends.
            Nothing is uploaded to or stored by Syntag.
          </p>
        </article>
        <article>
          <Icon name="copy" />
          <h3>JSON sidecar</h3>
          <p>
            The JSON sidecar contains the source hash, disclosure settings, and
            timestamp. It is generated as a local download alongside the marked
            asset; the image bytes never pass through a Syntag server.
          </p>
        </article>
        <article>
          <Logo size={50} />
          <h3>No product branding</h3>
          <p>
            The label states the AI status. It does not include the Syntag name.
          </p>
        </article>
      </div>
      <section className="privacy-context">
        <h2>Why this exists</h2>
        <p>
          Declaring AI use should be as easy and accessible as adding a caption.
          Syntag gives creators a clear label, a visual EU option, and a small
          browser API so disclosure can fit into the tools they already use.
        </p>
        <p>
          When MCP is used, a connected tool sends settings to the browser
          bridge. The browser reads the selected file, adds the disclosure, and
          returns export metadata. When JSON sidecar is enabled, only metadata
          is written to the sidecar download. The source image is never stored
          on a Syntag server.
        </p>
      </section>
      <section className="content-methods">
        <div className="content-methods-intro">
          <h2>One disclosure model, adapted to each format.</h2>
        </div>
        <div className="content-methods-grid">
          <article><div className="method-visual"><FormatIcon type="image" /></div><h3>Images</h3><p>The mark is composited onto the original pixels at the chosen position, size, contrast, and opacity. The export keeps the source dimensions.</p></article>
          <article><div className="method-visual"><FormatIcon type="video" /></div><h3>Video</h3><p>Frames are processed in the browser and recorded into a new video file with the disclosure visible throughout playback.</p></article>
          <article><div className="method-visual"><FormatIcon type="audio" /></div><h3>Audio</h3><p>Audio has no visual surface, so the exported WAV carries the disclosure in its metadata. Studio shows the selected label beside the player.</p></article>
          <article><div className="method-visual"><FormatIcon type="pdf" /></div><h3>PDFs</h3><p>The disclosure is drawn onto every page using the page’s own dimensions. The result is a new PDF with the source content and mark together.</p></article>
        </div>
      </section>
      <section className="privacy-context usage-disclosure">
        <h2>Aggregate usage statistics</h2>
        <p>
          Syntag records a small set of anonymous product events through the
          page views, label selections, selected file type, and completed exports.
          We do not send file bytes, filenames, disclosure content,
          cookies, or account identifiers.
        </p>
        <p>
          These statistics help us understand which parts of the tool are used
          and where to improve it. Processing remains local in your browser.
          Do Not Track is respected, and the usage endpoint accepts only the
          documented event types.
        </p>
      </section>
    </Page>
  );
}
function Contact() {
  return (
    <Page
      title="Contact"
      intro="A standalone project for making AI disclosure clear and accessible."
    >
      <section className="contact-panel">
        <div>
          <h2>Syntag is built in the open.</h2>
        </div>
        <div className="contact-copy">
          <p>
            For questions, feedback, or collaboration, contact Sabrina at{" "}
            <a href="mailto:sabrina@gejststudio.com">sabrina@gejststudio.com</a>.
          </p>
          <p>
            Syntag is an independent project supported by{" "}
            <a href="https://gejststudio.com" target="_blank" rel="noreferrer">
              Gejst Studio
            </a>
            . It has its own interface, processing model, and privacy
            commitments, with Gejst Studio providing support behind the project.
          </p>
        </div>
      </section>
    </Page>
  );
}
function RpcConsole() {
  const [input, setInput] = useState(
      '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}',
    ),
    [output, setOutput] = useState("Ready.");
  async function run() {
    try {
      const result = await window.SyntagMCP.handle(JSON.parse(input));
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(JSON.stringify({ error: error.message }, null, 2));
    }
  }
  return (
    <section className="rpc-console">
      <div>
        <h2>Local MCP bridge</h2>
        <button onClick={run}>Run request</button>
      </div>
      <label htmlFor="rpc-input">JSON-RPC request</label>
      <textarea
        id="rpc-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <pre aria-live="polite">{output}</pre>
    </section>
  );
}
function Page({ title, intro, children }) {
  return (
    <section className="subpage">
      <div className="sub-hero">
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {children}
    </section>
  );
}
function Code({ title, code }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="code-card">
      <div>
        <h2>{title}</h2>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{code}</pre>
    </article>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
