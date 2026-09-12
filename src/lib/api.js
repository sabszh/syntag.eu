import { DEFAULTS, normalizeOptions } from "./disclosure.js";
import { processFile, drawTag } from "./processors.js";
import { downloadResult } from "./metadata.js";

export const MCP_TOOL = {
  name: "syntag_tag_asset",
  description:
    "Add an AI disclosure to an image, video, PDF, or audio file in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      settings: {
        type: "object",
        properties: {
          level: { enum: ["involved", "generated", "modified"] },
          theme: { enum: ["mono", "metal", "outline", "eu"] },
          position: {
            enum: [
              "top-left",
              "top-right",
              "center",
              "bottom-left",
              "bottom-right",
            ],
          },
          size: { enum: ["small", "medium", "large"] },
          opacity: { type: "number", minimum: 0.35, maximum: 1 },
          euVariant: {
            enum: ["auto", "black", "white", "black-50", "white-50"],
          },
          sidecar: { type: "boolean" },
          embedMetadata: { type: "boolean" },
          audioTone: { type: "boolean" },
          language: {
            enum: ["en", "da", "de", "fr", "es", "it", "nl", "pl"],
            description: "Language used for text-based disclosure labels.",
          },
        },
      },
    },
    additionalProperties: false,
  },
};

export function installBrowserApi(getCurrentFile) {
  window.Syntag = {
    version: "0.3.0",
    defaults: { ...DEFAULTS },
    process: processFile,
    download: downloadResult,
    drawTag,
    normalizeOptions,
  };
  window.SyntagMCP = {
    version: "0.3.0-browser",
    tool: MCP_TOOL,
    lastResult: null,
    async handle(req) {
      const base = { jsonrpc: "2.0", id: req?.id ?? null };
      if (req?.method === "tools/list")
        return { ...base, result: { tools: [MCP_TOOL] } };
      if (req?.method === "tools/call") {
        if (req?.params?.name !== MCP_TOOL.name)
          return { ...base, error: { code: -32602, message: "Unknown tool" } };
        const file = req.params.file || getCurrentFile?.();
        if (!file)
          return {
            ...base,
            error: {
              code: -32001,
              message: "No file supplied and no file selected in Studio",
            },
          };
        try {
          const result = await processFile(
            file,
            req.params.arguments?.settings || {},
          );
          window.SyntagMCP.lastResult = result;
          return {
            ...base,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      ok: true,
                      outputType: result.blob.type,
                      outputBytes: result.blob.size,
                      metadata: result.metadata,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: false,
            },
          };
        } catch (error) {
          return { ...base, error: { code: -32002, message: error.message } };
        }
      }
      return { ...base, error: { code: -32601, message: "Method not found" } };
    },
  };
  return () => {
    delete window.Syntag;
    delete window.SyntagMCP;
  };
}
