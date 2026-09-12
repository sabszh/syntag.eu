import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  euAsset,
  kindOf,
  normalizeOptions,
  validateFile,
} from "./disclosure.js";
import { getLabel } from "./locales.js";
import { sha256 } from "./metadata.js";
import { inspectAsset } from "./verification.js";

const file = (name, type, size = 10) => ({ name, type, size });
describe("disclosure model", () => {
  it("uses stable defaults", () =>
    expect(normalizeOptions({})).toMatchObject(DEFAULTS));
  it("always keeps the JSON sidecar enabled", () =>
    expect(normalizeOptions({ sidecar: false }).sidecar).toBe(true));
  it("falls back from invalid settings", () =>
    expect(normalizeOptions({ level: "nope", theme: "purple" })).toMatchObject({
      level: "generated",
      theme: "eu",
    }));
  it("enforces EU minimum opacity", () =>
    expect(normalizeOptions({ theme: "eu", opacity: 0.1 }).opacity).toBe(0.5));
  it("accepts supported label languages and falls back safely", () => {
    expect(normalizeOptions({ language: "da" }).language).toBe("da");
    expect(normalizeOptions({ language: "xx" }).language).toBe("en");
    expect(getLabel("generated", "da")).toBe("AI-GENERERET");
    expect(getLabel("involved", "en")).toBe("AI");
  });
  it("checks embedded metadata and a matching sidecar", async () => {
    const file = new File([
      '<syntag:DisclosureLevel>generated</syntag:DisclosureLevel><syntag:DisclosureLabel>AI GENERATED</syntag:DisclosureLabel>',
    ], "asset.png", { type: "image/png" });
    const report = await inspectAsset(file, new File([JSON.stringify({ source: { sha256: await sha256(file) } })], "asset.syntag.json"));
    expect(report.embedded).toBe(true);
    expect(report.sidecarMatches).toBe(true);
  });
  it("maps EU semantic levels", () =>
    expect(euAsset("modified")).toBe("/eu-modified-black.svg"));
  it("recognizes supported kinds", () => {
    expect(kindOf(file("a.png", "image/png"))).toBe("image");
    expect(kindOf(file("a.pdf", "application/pdf"))).toBe("pdf");
    expect(kindOf(file("assets.zip", "application/zip"))).toBe("zip");
  });
  it("rejects unsupported files", () =>
    expect(() =>
      validateFile(file("a.exe", "application/octet-stream")),
    ).toThrow(/Unsupported/));
});
