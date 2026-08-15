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
import { processFile } from "./lib/processors.js";
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
        <div className="local">
          <span />
          Local processing
        </div>
      </header>
      <main key={route} className="route" tabIndex="-1" ref={mainRef}>
        {route === "studio" ? (
          <Studio />
        ) : route === "convention" ? (
          <Convention />
        ) : route === "developers" ? (
          <Developers />
        ) : (
          <Trust />
        )}
      </main>
    </div>
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
    setUrl(URL.createObjectURL(f));
    setNotice({ text: "Ready to export", tone: "ready" });
  }
  function update(k, v) {
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
        <ol className="flow" aria-label="Workflow">
          <li>Upload</li>
          <li>Choose label</li>
          <li>Export</li>
        </ol>
      </div>
      <div className="workbench">
        <aside className="rail">
          <Head title="Source file" />
          <button
            className={`drop ${file ? "has-file" : ""} ${dragging ? "is-dragging" : ""}`}
            onClick={() => input.current?.click()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={input}
              hidden
              type="file"
              accept="image/*,video/*,audio/*,.pdf"
              onChange={(e) => choose(e.target.files[0])}
            />
            <span className="upload-icon">
              <Icon name="upload" />
            </span>
            <strong>{file ? "Select another file" : "Select file"}</strong>
            <small>or drop it here</small>
            <span className="file-types">Image · Video · Audio · PDF</span>
          </button>
          {file && (
            <div className="file-row">
              <span>{kind || "file"}</span>
              <div>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  activeStudioFile = null;
                  setUrl("");
                  setNotice({ text: "", tone: "idle" });
                  if (input.current) input.current.value = "";
                }}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          )}
          <div className="privacy">
            <Icon name="shield" />
            <div>
              <strong>Processed locally</strong>
              <p>
                The file stays in this browser session. No account is required.
              </p>
            </div>
          </div>
        </aside>
        <section className="canvas-wrap">
          <div className="canvas-bar">
            <h2>Preview</h2>
            <div className="zoom">{file ? kind : "No file"}</div>
          </div>
          <div className="canvas">
            {!file && (
              <div className="empty">
                <Logo size={78} />
                <h3>No file selected</h3>
                <p>Select an image, video, audio file, or PDF.</p>
              </div>
            )}
            {file && <Preview file={file} url={url} />}{" "}
            {file && <Tag opts={opts} />}
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
          <div className="tag-sample">
            <Tag opts={{ ...opts, position: "sample" }} />
          </div>
          <Control label="Label">
            <div className="level-choices">
              {Object.entries(LEVELS).map(([value, item]) => (
                <button
                  key={value}
                  className={opts.level === value ? "selected" : ""}
                  onClick={() => update("level", value)}
                  aria-pressed={opts.level === value}
                >
                  <span>{item.label.replace("AI ", "")}</span>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </Control>
          <Control label="Theme">
            <select
              value={opts.theme}
              onChange={(e) => update("theme", e.target.value)}
            >
              <option value="mono">Black</option>
              <option value="metal">Metal</option>
              <option value="outline">Outline</option>
              <option value="eu">EU icon</option>
            </select>
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
          <details className="advanced">
            <summary>
              <span>More settings</span>
              <Icon name="chevron" />
            </summary>
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
            <label className="sidecar">
              <span>
                <strong>JSON sidecar</strong>
                <small>Save settings, source hash, and timestamp</small>
              </span>
              <input
                type="checkbox"
                checked={opts.sidecar}
                onChange={(e) => update("sidecar", e.target.checked)}
              />
              <i />
            </label>
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
          </details>
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
                  ? "Export marked asset"
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
function Preview({ file, url }) {
  if (file.type.startsWith("image/"))
    return <img src={url} alt="Asset preview" />;
  if (file.type.startsWith("video/")) return <video src={url} controls />;
  if (file.type.startsWith("audio/")) return <audio src={url} controls />;
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
        <svg
          viewBox="110 590 2280 470"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <image
            href={euAsset(opts.level, "black")}
            width="2501"
            height="1668"
          />
        </svg>
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
        {Object.entries(labels).map(([k, v], i) => (
          <article key={k}>
            <span>0{i + 1}</span>
            <Tag
              opts={{
                ...defaults,
                level: k,
                theme: i === 1 ? "metal" : "mono",
                position: "sample",
                size: "medium",
              }}
            />
            <h3>{v}</h3>
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
          Syntag maps its three levels to the EU basic, fully generated, and
          partially modified icons. The icons do not by themselves prove
          compliance.
        </p>
      </section>
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
          code={`const result = await Syntag.process(file, {\n  level: "generated",\n  theme: "mono",\n  position: "bottom-right"\n});`}
        />
        <Code
          title="MCP tool"
          code={`{\n  "name": "syntag_tag_asset",\n  "arguments": {\n    "settings": { "theme": "eu" }\n  }\n}`}
        />
      </div>
      <RpcConsole />
      <p className="footnote">
        A browser tab cannot provide an MCP stdio or HTTP transport. That
        requires a separate host process.
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
          <p>Preview and export run in browser APIs.</p>
        </article>
        <article>
          <Icon name="copy" />
          <h3>JSON sidecar</h3>
          <p>
            The optional sidecar stores the source hash, disclosure settings,
            and timestamp.
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
