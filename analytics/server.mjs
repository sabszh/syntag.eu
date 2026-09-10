import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const DATA_FILE = process.env.DATA_FILE || "/data/usage.json";
const EVENTS = new Set(["page_view", "label_selected", "file_selected", "export_completed"]);
let state = { total: 0, events: {}, kinds: {}, routes: {}, days: {} };
let writeQueue = Promise.resolve();
try { state = { ...state, ...JSON.parse(await readFile(DATA_FILE, "utf8")) }; } catch {}
const increment = (bucket, key) => { if (key) bucket[key] = (bucket[key] || 0) + 1; };
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/healthz" && req.method === "GET") return json(res, 200, { ok: true });
  if (url.pathname === "/api/usage/stats" && req.method === "GET") return json(res, 200, state);
  if (url.pathname !== "/api/usage" || req.method !== "POST") return json(res, 404, { error: "Not found" });
  let body = "";
  req.on("data", chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
  req.on("end", async () => {
    try {
      const input = JSON.parse(body); const event = typeof input.event === "string" ? input.event : "";
      if (!EVENTS.has(event)) return json(res, 400, { error: "Invalid event" });
      const kind = typeof input.kind === "string" ? input.kind.slice(0, 16) : "";
      const route = typeof input.route === "string" ? input.route.slice(0, 24) : "";
      state.total += 1; increment(state.events, event); increment(state.kinds, kind); increment(state.routes, route); increment(state.days, new Date().toISOString().slice(0, 10));
      writeQueue = writeQueue.then(async () => { await mkdir(dirname(DATA_FILE), { recursive: true }); await writeFile(DATA_FILE, JSON.stringify(state), "utf8"); });
      await writeQueue; res.writeHead(204, { "cache-control": "no-store" }); res.end();
    } catch { json(res, 400, { error: "Invalid request" }); }
  });
});
server.listen(PORT, "0.0.0.0");
