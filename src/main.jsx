import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
import { downloadResult } from "./lib/metadata.js";
import { installBrowserApi } from "./lib/api.js";

const labels = Object.fromEntries(
  Object.entries(LEVELS).map(([key, value]) => [key, value.label]),
);
let activeStudioFile = null;
const pages = [
  ["studio", "Studio"],
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
  const mainRef = useRef(null);
  useEffect(() => {
    const f = () => setRoute(routeFromHash());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const go = (p) => (location.hash = `/${p}`);
  useEffect(() => installBrowserApi(() => activeStudioFile), []);
  useEffect(() => mainRef.current?.focus(), [route]);
  return (
    <div className="app">
      <header className="topbar">
        <button className="wordmark" onClick={() => go("studio")}>
          <Logo />
          <span>Syntag</span>
        </button>
        <nav>
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
                <p>Drop your file here, or <span>browse files</span></p>
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
                  onClick={() => update("level", value)}>{item.label.replace("AI ", "").toLowerCase()}</button>
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
          </div>
          {progress > 0 && (
            <progress className="export-progress" max="1" value={progress}>
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
      title="Browser API and JSON-RPC"
      intro="Both interfaces call the same browser-side processor."
    >
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
      <RpcConsole />
      <p className="footnote">
        The browser bridge is the working integration: it calls the same
        processor as Studio and keeps the selected file in the browser session.
        A standalone stdio transport can be added when an external host needs
        to connect to the browser.
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
          <span className="eyebrow">How it works</span>
          <h2>One disclosure model, adapted to each format.</h2>
        </div>
        <div className="content-methods-grid">
          <article><div className="method-visual"><FormatIcon type="image" /></div><h3>Images</h3><p>The mark is composited onto the original pixels at the chosen position, size, contrast, and opacity. The export keeps the source dimensions.</p></article>
          <article><div className="method-visual"><FormatIcon type="video" /></div><h3>Video</h3><p>Frames are processed in the browser and recorded into a new video file with the disclosure visible throughout playback.</p></article>
          <article><div className="method-visual"><FormatIcon type="audio" /></div><h3>Audio</h3><p>Audio has no visual surface, so the exported WAV carries the disclosure in its metadata. Studio shows the selected label beside the player.</p></article>
          <article><div className="method-visual"><FormatIcon type="pdf" /></div><h3>PDFs</h3><p>The disclosure is drawn onto every page using the page’s own dimensions. The result is a new PDF with the source content and mark together.</p></article>
        </div>
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
          <span className="eyebrow">Get in touch</span>
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
