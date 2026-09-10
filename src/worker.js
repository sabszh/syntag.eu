const EVENTS = new Set(["page_view", "file_selected", "export_completed"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/usage" && request.method === "POST") {
      try {
        const body = await request.json();
        const event = typeof body.event === "string" ? body.event : "";
        if (!EVENTS.has(event)) return json({ error: "Invalid event" }, 400);
        const kind = typeof body.kind === "string" ? body.kind.slice(0, 16) : "";
        const route = typeof body.route === "string" ? body.route.slice(0, 24) : "";
        env.ANALYTICS?.writeDataPoint({
          blobs: [event, kind, route],
          doubles: [1],
          indexes: [event],
        });
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      } catch {
        return json({ error: "Invalid request" }, 400);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
