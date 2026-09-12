#!/usr/bin/env node

/**
 * Privacy-preserving local Syntag integration.
 *
 * The process intentionally binds to loopback only. It never makes outbound
 * requests and never sends asset bytes to syntag.eu.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { LEVELS, normalizeOptions } from "../src/lib/disclosure.js";
import { buildXmp } from "../src/lib/xmp.js";

const HOST = process.env.SYNTAG_LOCAL_HOST || "127.0.0.1";
const PORT = Number(process.env.SYNTAG_LOCAL_PORT || 4317);
const MAX_IMAGE_BYTES = 80 * 1024 ** 2;
const root = resolve(new URL("../", import.meta.url).pathname);

const tool = {
  name: "syntag_tag_asset",
  description:
    "Add an AI disclosure to an image locally. Asset bytes never leave this device.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Path to a local image file." },
      settings: {
        type: "object",
        properties: {
          level: { enum: ["involved", "generated", "modified"] },
          theme: { enum: ["mono", "metal", "outline", "eu"] },
          euVariant: { enum: ["auto", "black", "white", "black-50", "white-50"] },
          position: { enum: ["top-left", "top-right", "center", "bottom-left", "bottom-right"] },
          size: { enum: ["small", "medium", "large"] },
          opacity: { type: "number", minimum: 0.35, maximum: 1 },
          embedMetadata: { type: "boolean" },
        },
      },
    },
    required: ["filePath"],
    additionalProperties: false,
  },
};

function positionFor(width, height, tw, th, position) {
  const margin = Math.min(width, height) * 0.035;
  return {
    "top-left": [margin, margin],
    "top-right": [width - tw - margin, margin],
    center: [(width - tw) / 2, (height - th) / 2],
    "bottom-left": [margin, height - th - margin],
    "bottom-right": [width - tw - margin, height - th - margin],
  }[position];
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

function textOverlay(width, height, options) {
  const label = LEVELS[options.level].label;
  const fontSize = Math.max(13, Math.min(width, height) * ({ small: 0.022, medium: 0.034, large: 0.05 }[options.size] || 0.034));
  const pad = fontSize * 0.65;
  const badgeWidth = Math.max(fontSize * 7, fontSize * (label.length * 0.56 + 3.5));
  const badgeHeight = fontSize + pad;
  const [x, y] = positionFor(width, height, badgeWidth, badgeHeight, options.position);
  const outline = options.theme === "outline";
  const fill = options.theme === "metal" ? "#d8d8d8" : outline ? "#ffffff" : "#000000";
  const foreground = outline || options.theme === "metal" ? "#000000" : "#ffffff";
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g opacity="${options.opacity}"><rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="${fill}" ${outline ? 'stroke="#000" stroke-width="2"' : ""}/><rect x="${x + pad * 0.65}" y="${y + (badgeHeight - fontSize * 0.95) / 2}" width="${fontSize * 0.95}" height="${fontSize * 0.95}" fill="none" stroke="${foreground}" stroke-width="${Math.max(1, fontSize * 0.055)}"/><text x="${x + pad * 0.65 + fontSize * 0.475}" y="${y + badgeHeight / 2 + fontSize * 0.15}" text-anchor="middle" font-family="Arial" font-size="${fontSize * 0.43}" font-weight="800" fill="${foreground}">AI</text><text x="${x + pad * 0.65 + fontSize * 0.95 + fontSize * 0.35}" y="${y + badgeHeight / 2 + fontSize * 0.34}" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="${foreground}">${escapeXml(label)}</text></g></svg>`);
}

async function euOverlay(width, height, options) {
  const variant = options.euVariant === "auto" ? "black" : options.euVariant.startsWith("white") ? "white" : "black";
  const filename = `eu-${LEVELS[options.level].eu}-${variant}.svg`;
  const source = await readFile(resolve(root, "public", filename));
  const icon = await sharp(source).metadata();
  const fontSize = Math.max(13, Math.min(width, height) * ({ small: 0.022, medium: 0.034, large: 0.05 }[options.size] || 0.034));
  const th = Math.min(fontSize * 1.65, height * 0.8);
  const tw = Math.min(th * (icon.width / icon.height), width * 0.9);
  const [x, y] = positionFor(width, height, tw, th, options.position);
  const resized = await sharp(source)
    .resize({ width: Math.round(tw), height: Math.round(th) })
    .png()
    .toBuffer();
  return { input: resized, left: Math.round(x), top: Math.round(y), opacity: options.opacity * (options.euVariant.endsWith("-50") ? 0.5 : 1) };
}

async function tagImage(input, filename, settings = {}) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new Error("Image data is required");
  if (input.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 80 MB local-processing limit");
  const options = normalizeOptions(settings);
  const image = sharp(input, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not decode image");
  const overlay = options.theme === "eu" ? await euOverlay(metadata.width, metadata.height, options) : { input: textOverlay(metadata.width, metadata.height, options), left: 0, top: 0 };
  const outputType = metadata.format === "jpeg" ? "jpeg" : "png";
  const outputMime = `image/${outputType}`;
  const provenance = {
    visibleDisclosure: true,
    embeddedXmp: options.embedMetadata !== false,
    c2pa: false,
  };
  const sidecarMetadata = {
    createdAt: new Date().toISOString(),
    processing: "local-cli",
    source: {
      name: basename(filename),
      type: metadata.format ? `image/${metadata.format}` : "image/*",
      size: input.length,
      sha256: createHash("sha256").update(input).digest("hex"),
    },
    disclosure: { ...options, label: LEVELS[options.level].label },
    provenance,
    output: { type: outputMime, extension: outputType },
  };
  const pipeline = image.composite([overlay]).withMetadata();
  if (provenance.embeddedXmp) pipeline.withXmp(buildXmp(sidecarMetadata));
  const output = await pipeline.toFormat(outputType, outputType === "jpeg" ? { quality: 94 } : undefined).toBuffer();
  return { output, contentType: `image/${outputType}`, filename: `${basename(filename, extname(filename))}-syntag.${outputType}`, options };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES + 1024 * 1024) throw new Error("Request exceeds the local size limit");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "http://localhost", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function callTool(args = {}) {
  if (!args.filePath) throw new Error("filePath is required for the local MCP server");
  const filePath = resolve(args.filePath);
  const input = await readFile(filePath);
  const result = await tagImage(input, filePath, args.settings);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(resolve(filePath, "..", result.filename), result.output));
  return { ok: true, outputPath: resolve(filePath, "..", result.filename), outputBytes: result.output.length, contentType: result.contentType, settings: result.options };
}

async function handleRpc(message) {
  const base = { jsonrpc: "2.0", id: message?.id ?? null };
  if (message?.method === "initialize") return { ...base, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "syntag-local", version: "0.1.0" } } };
  if (message?.method === "notifications/initialized") return null;
  if (message?.method === "tools/list") return { ...base, result: { tools: [tool] } };
  if (message?.method === "tools/call" && message.params?.name === tool.name) {
    try { return { ...base, result: { content: [{ type: "text", text: JSON.stringify(await callTool(message.params.arguments), null, 2) }] } }; }
    catch (error) { return { ...base, error: { code: -32002, message: error.message } }; }
  }
  return { ...base, error: { code: -32601, message: "Method not found" } };
}

function startHttp() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "http://localhost", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }); return res.end(); }
      if (req.method === "GET" && req.url === "/healthz") return json(res, 200, { ok: true, local: true });
      if (req.method === "POST" && req.url === "/mcp") return json(res, 200, await handleRpc(await readJson(req)));
      if (req.method === "POST" && req.url === "/v1/tag") {
        const body = await readJson(req);
        const input = Buffer.from(body.assetBase64 || "", "base64");
        const result = await tagImage(input, body.filename || "asset.png", body.settings);
        return json(res, 200, { ...result, outputBase64: result.output.toString("base64"), output: undefined });
      }
      json(res, 404, { error: "Not found" });
    } catch (error) { json(res, 400, { error: error.message }); }
  });
  server.listen(PORT, HOST, () => console.error(`Syntag local API listening on http://${HOST}:${PORT}`));
}

const command = process.argv[2];

if (process.argv.includes("--stdio") || command === "mcp") {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
      if (!line) continue;
      handleRpc(JSON.parse(line)).then((response) => { if (response) process.stdout.write(`${JSON.stringify(response)}\n`); });
    }
  });
} else if (command === "tag") {
  callTool({ filePath: process.argv[3], settings: {} })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
} else if (command === "api" || !command) startHttp();
else {
  console.error("Usage: syntag mcp | syntag api | syntag tag <image-path>");
  process.exitCode = 1;
}
