# Syntag production readiness plan

## 1. Product and content

- Confirm the three disclosure labels and EU icon mappings with a legal or policy review.
- Add final copy for privacy, terms, accessibility, and contact ownership.
- Decide whether the standalone MCP server is part of the first release or a follow-up.

## 2. Processing and API

- Test image, video, audio, and PDF processing with representative files and large-file limits.
- Verify that exports preserve dimensions, metadata behavior, transparency, and correct EU icon contrast.
- Add automated tests for every Browser API and JSON-RPC method, including malformed requests and missing files.
- Define the MCP transport: local stdio for desktop clients, or authenticated Streamable HTTP for remote clients.
- Keep server-side processing opt-in and document that a standalone server receives file bytes.

## 3. Security and privacy

- Set a strict Content Security Policy, secure headers, and dependency audit in deployment.
- Confirm no uploaded bytes, object URLs, or temporary files are retained after processing.
- Add file size, type, and decompression safeguards for hostile inputs.
- If HTTP MCP is enabled, add authentication, rate limits, request size limits, and CORS rules.
- Publish a short data-flow explanation and retention policy.

## 4. Accessibility and quality

- Run keyboard-only checks across upload, label, theme, position, contrast, and export controls.
- Verify focus visibility, screen-reader names, reduced motion/transparency, and WCAG color contrast.
- Test responsive layouts at phone, tablet, and desktop widths.
- Add end-to-end browser checks for upload, preview, export, reset, and route navigation.

## 5. Deployment and operations

- Deploy a production build behind HTTPS with immutable asset caching and compression.
- Add health checks, error reporting, uptime monitoring, and a rollback procedure.
- Validate Cloudflare or container configuration in a staging environment before the first release.
- Pin runtime and dependency versions, then review upgrade cadence and license notices.

## 6. Release gate

- `npm run build`, `npm run lint`, `npm test`, and `git diff --check` pass.
- Staging smoke test passes on all four routes and the Contact page.
- A real export is opened and inspected for each supported file type.
- Privacy, accessibility, security, and MCP decisions are documented.
- Production URL, owner, support email, and rollback contact are recorded.
