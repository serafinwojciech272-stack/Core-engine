// External worker process for durable agent runs: `npm run agent:worker` (add `-- --sandbox` to run code).
// Needs the same store/LLM env as the web service (SUPABASE_URL + key, ANTHROPIC_API_KEY, AGENT_LLM_MODEL…).
// With --sandbox (or AGENT_SANDBOX=local) it also claims runs that require code execution (ADR-003),
// e.g. a worker on your own PC serving the free Render web service.
import { runWorkerLoop } from "@/lib/agent-loop/worker";
import { describeLlmConfig } from "@/lib/agent-loop/llm";
import { runStoreKind } from "@/lib/agent-loop/store";

if (process.argv.includes("--sandbox")) process.env.AGENT_SANDBOX = "local";

const llm = describeLlmConfig();
const store = runStoreKind();
console.log(`[agent-worker] pid ${process.pid} · llm ${llm.provider ?? "-"}/${llm.model ?? "-"} · store ${store} · sandbox ${process.env.AGENT_SANDBOX === "local" ? "on" : "off"}`);
if (!llm.configured) { console.error("[agent-worker] LLM not configured:", llm.issue); process.exit(1); }
if (store !== "supabase") console.warn("[agent-worker] store is not supabase — this worker will not see runs created by the web service");

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
await runWorkerLoop({ signal: controller.signal });
console.log("[agent-worker] stopped");
