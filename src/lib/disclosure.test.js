import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  euAsset,
  kindOf,
  normalizeOptions,
  validateFile,
} from "./disclosure.js";

const file = (name, type, size = 10) => ({ name, type, size });
describe("disclosure model", () => {
  it("uses stable defaults", () =>
    expect(normalizeOptions({})).toMatchObject(DEFAULTS));
  it("falls back from invalid settings", () =>
    expect(normalizeOptions({ level: "nope", theme: "purple" })).toMatchObject({
      level: "generated",
      theme: "mono",
    }));
  it("enforces EU minimum opacity", () =>
    expect(normalizeOptions({ theme: "eu", opacity: 0.1 }).opacity).toBe(0.5));
  it("maps EU semantic levels", () =>
    expect(euAsset("modified")).toBe("/eu-modified-black.png"));
  it("recognizes supported kinds", () => {
    expect(kindOf(file("a.png", "image/png"))).toBe("image");
    expect(kindOf(file("a.pdf", "application/pdf"))).toBe("pdf");
  });
  it("rejects unsupported files", () =>
    expect(() =>
      validateFile(file("a.exe", "application/octet-stream")),
    ).toThrow(/Unsupported/));
});
