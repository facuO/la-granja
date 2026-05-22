export async function api(path, opts = {}) {
  const hasBody = opts.body !== undefined && opts.body !== null;
  const headers = { ...(opts.headers || {}) };
  // Only set content-type when actually sending a body — Fastify rejects POSTs
  // with content-type: application/json and an empty body.
  if (hasBody && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  const fetchOpts = {
    credentials: "include",
    ...opts,
    headers,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  };
  const res = await fetch(path, fetchOpts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
