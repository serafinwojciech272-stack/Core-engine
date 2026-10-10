// External worker process for durable agent runs: `npm run agent:worker`.
// Requires the same store/LLM env as the web service (AGENT_RUN_STORE, AGENT_RUN_DIR, AGENT_LLM_*).
import { runWorkerLoop } from "@/lib/agent-loop/worker";

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
console.log("[agent-worker] started, pid", process.pid);
await runWorkerLoop({ signal: controller.signal });
console.log("[agent-worker] stopped");
