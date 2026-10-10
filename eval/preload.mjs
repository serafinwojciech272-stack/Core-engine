// Loaded via NODE_OPTIONS="--import ./eval/preload.mjs" into the Core Engine server process.
// Redirects outbound provider calls to the local eval proxy so every LLM/tool call is
// observable, budget-capped and reproducible. Production code is not modified.
const PROXY = process.env.EVAL_PROXY_URL || "http://127.0.0.1:4500";
const HOSTS = {
  "openrouter.ai": "openrouter",
  "api.openai.com": "openai",
  "api.x.ai": "xai",
  "geocoding-api.open-meteo.com": "geocoding",
  "api.open-meteo.com": "forecast",
};

const originalFetch = globalThis.fetch;

function rewrite(url) {
  try {
    const u = new URL(url);
    const key = HOSTS[u.hostname];
    if (!key) return null;
    return `${PROXY}/${key}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

globalThis.fetch = async function evalFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  const target = url ? rewrite(url) : null;
  if (!target) return originalFetch(input, init);
  if (input instanceof Request) {
    const body = init?.body ?? (input.method === "GET" || input.method === "HEAD" ? undefined : await input.clone().arrayBuffer());
    return originalFetch(target, { method: input.method, headers: input.headers, body, signal: init?.signal ?? input.signal, ...init });
  }
  return originalFetch(target, init);
};
