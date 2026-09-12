# Syntag EU

React/Vite app for adding AI disclosures to media. Processing happens in the
browser; no backend, database, API keys, or persistent container volumes are required.

## License

Syntag is free software licensed under the GNU General Public License version 3
or any later version (`GPL-3.0-or-later`). See [LICENSE](LICENSE) for the
license notice and the [official license text](https://www.gnu.org/licenses/gpl-3.0.html).

## Local development

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Validation: `npm run build`, `npm test`, and `npm run lint`.

## Local MCP and API

Syntag also includes an opt-in local companion process for developers who need
automation without sending image bytes to Syntag or any other remote server.
It binds to `127.0.0.1` only and supports image tagging.

Run the local HTTP API:

```sh
npm run local:api
curl http://127.0.0.1:4317/healthz
```

The `POST /v1/tag` endpoint accepts JSON containing `filename`, `assetBase64`,
and optional `settings`, then returns the tagged asset as `outputBase64`.

For MCP desktop clients, configure the local stdio server:

```json
{
  "mcpServers": {
    "syntag-local": {
      "command": "npm",
      "args": ["run", "local:mcp", "--prefix", "/path/to/syntag"]
    }
  }
}
```

The MCP tool is `syntag_tag_asset` and accepts a local `filePath` plus the same
disclosure settings used by Studio. The tagged output is written beside the
source file. The local process makes no outbound network requests.

For PNG and JPEG image exports, embedded metadata is enabled by default. Syntag
writes an XMP packet with IPTC-compatible disclosure fields, the disclosure
level, processing mode, and source hash. This is portable metadata, not a
cryptographically signed C2PA Content Credential. The JSON sidecar remains
the fuller audit record.

Once published, the same tool can be installed without cloning the repository:

```sh
npx @sabszh/syntag-local mcp
npx @sabszh/syntag-local api
npx @sabszh/syntag-local tag ./image.png
```

The package is intended for local use. It does not upload files, require a
Syntag account, or contact `syntag.eu`.

Studio includes a label-language setting for English, Danish, German,
French, Spanish, Italian, Dutch, and Polish. It changes text-based disclosure
labels and the corresponding metadata; the EU icon remains language-neutral.
When a ZIP is selected in Studio, it is processed locally and returned as one
ZIP with a JSON sidecar for every asset.

Verify can also read an existing C2PA Content Credential in the browser using
the official `c2pa-web` reader. Syntag does not create a fake unsigned
credential: signing requires a configured certificate and private key. Current
browser exports report C2PA as absent while keeping the XMP and sidecar
provenance explicit; the local CLI can opt into signing as described below.

The local CLI can sign JPEG and PNG exports when the signing material is
provided by the workstation environment:

```sh
export SYNTAG_C2PA_CERT=/secure/path/certificate.pem
export SYNTAG_C2PA_KEY=/secure/path/private-key.pem
npx @sabszh/syntag-local tag ./image.png
```

The key is read locally and is never sent to Syntag. Keep it outside the
repository and use a certificate chain trusted by the systems that will read
the credential. `SYNTAG_C2PA_ALG` defaults to `es256`; `SYNTAG_C2PA_TSA` is an
optional timestamp authority URL.

## Deploy to Cloudflare from GitHub

The repository is configured for Cloudflare Workers Static Assets. Cloudflare
serves the Vite production build directly, including SPA fallback routing.
The Worker also exposes `POST /api/usage` and writes a small, allow-listed set
of aggregate events to the `syntag_usage` Workers Analytics Engine dataset.
Events contain only event name, file kind, route, and a count; file bytes and
filenames never enter the endpoint.

The VPS deployment uses the same `POST /api/usage` contract with a local,
Docker-volume-backed collector. It keeps aggregate counts only; no cookies,
identifiers, IP addresses, or file bytes are collected.

Before the first deploy, enable Workers Analytics Engine for the Cloudflare
account in the [Analytics Engine dashboard](https://dash.cloudflare.com/?to=/:account/workers/analytics-engine).
This is an account-level prerequisite; Wrangler will report error `10089` until
it is enabled. The dataset itself is created automatically on the first write.

After committing and pushing these files to GitHub, connect this repository in
Cloudflare Workers & Pages and create a Worker with these build settings:

| Setting | Value |
| --- | --- |
| Worker name | `syntag-eu` (matches `wrangler.jsonc`) |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node.js version | `24` (set `NODE_VERSION=24` if overriding the build image) |

Choose the branch you want Cloudflare to deploy automatically. No application
secrets, database, Docker container, or VPS are required. Add a custom domain
in the Worker's settings after deployment; Cloudflare handles HTTPS.

For local deployment validation and manual deployment:

```sh
npm ci
npm run check:cloudflare
# Authenticate and publish only when ready:
npx wrangler login
npm run deploy
```

`check:cloudflare` builds and runs a Wrangler dry run without publishing.
`deploy` builds and publishes to the authenticated Cloudflare account.

After deployment, view the dataset in Cloudflare Analytics Engine or query it
with the Analytics Engine SQL API. A useful starting query is:

```sql
SELECT blob1 AS event, blob2 AS kind, blob3 AS route, SUM(double1) AS total
FROM syntag_usage
GROUP BY event, kind, route
ORDER BY total DESC
```

If using an existing **Cloudflare Pages** project instead, set the framework to
React (Vite), build command to `npm run build`, and output directory to `dist`.
Pages uses its own Git deployment flow; do not set a Workers deploy command there.

References: [Workers Git build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[static assets](https://developers.cloudflare.com/workers/static-assets/), and
[Pages build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Run on a VPS with Docker

Install Docker Engine with the Docker Compose plugin on the VPS, then copy this
project (including the Docker files) to it. From the project directory:

```sh
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:8080/healthz
```

Open `http://YOUR_VPS_IP:8080` and allow inbound TCP port 8080 in your VPS firewall
if accessing it directly. Change the published port if needed:

```sh
PORT=80 docker compose up -d --build
```

The multi-stage image builds with Node.js 24 and serves only the production files
with unprivileged Nginx on container port 8080. It includes a health check, automatic
restart after a crash or reboot, compressed responses, and caching for hashed assets.
Docker reports unhealthy containers; the restart policy does not restart a container
solely because its health check fails.

## Domain and HTTPS

Point your domain's DNS to the VPS and configure HTTPS in your reverse proxy
(for example, Caddy, Traefik, or Nginx). TLS is terminated by the proxy.
For a proxy running directly on the VPS, bind the app to localhost:

```sh
BIND_ADDRESS=127.0.0.1 PORT=8080 docker compose up -d --build
```

Forward the proxy to `http://127.0.0.1:8080`. For a proxy in Docker, attach it
to the same Docker network and forward to `http://syntag:8080` instead.
Use HTTPS for the public site so browser features requiring a secure context work.
You can save `BIND_ADDRESS` and `PORT` in a local `.env` file beside `compose.yaml`
to preserve those settings across subsequent commands. That file is ignored by Git
and excluded from the image.

## Updates and maintenance

After copying or pulling updated project files onto the VPS:

```sh
docker compose build --pull
docker compose up -d
docker compose logs --tail=100 -f
```

Stop with `docker compose down`. Logs are rotated to limit disk usage.
Rebuild to apply application changes or updated base images.

To build and run without Compose:

```sh
docker build -t syntag-eu .
docker run -d --name syntag --restart unless-stopped -p 8080:8080 syntag-eu
```
