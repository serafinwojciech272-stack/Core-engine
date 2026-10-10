// Worker wiring. Two modes (AGENT_WORKER_MODE):
//   inline   — the web process drains the queue in the background after each enqueue (dev / single box).
//   external — a separate long-lived process runs `npm run agent:worker` (production; survives web restarts).
import { AgentRunner } from "@/lib/agent-loop/runner";
import { createLlmClientFromEnv } from "@/lib/agent-loop/llm";
import { getRunStore } from "@/lib/agent-loop/store";

type InlineState = { running: boolean; again: boolean };
const root = globalThis as typeof globalThis & { __agentInlineWorker?: InlineState };

export function workerMode(): "inline" | "external" {
  return process.env.AGENT_WORKER_MODE === "external" ? "external" : "inline";
}

export function createRunnerFromEnv(owner?: string) {
  const llm = createLlmClientFromEnv();
  if (!llm) return null;
  return new AgentRunner({ store: getRunStore(), llm, owner });
}

/** Fire-and-forget: drains the queue inside this process. Coalesces concurrent kicks. */
export function kickInlineWorker() {
  if (workerMode() !== "inline") return;
  const state = (root.__agentInlineWorker ??= { running: false, again: false });
  if (state.running) { state.again = true; return; }
  const runner = createRunnerFromEnv("inline-" + process.pid);
  if (!runner) return;
  state.running = true;
  void (async () => {
    try {
      do { state.again = false; await runner.drainQueue(); } while (state.again);
    } catch (error) {
      console.error("[agent-loop] inline worker error", error instanceof Error ? error.message : error);
    } finally {
      state.running = false;
    }
  })();
}

/** Long-running poll loop for the external worker process. */
export async function runWorkerLoop(options: { pollMs?: number; signal?: AbortSignal } = {}) {
  const runner = createRunnerFromEnv("worker-" + process.pid);
  if (!runner) throw new Error("AGENT_LLM_NOT_CONFIGURED");
  const pollMs = options.pollMs ?? 2000;
  while (!options.signal?.aborted) {
    const processed = await runner.drainQueue().catch((error) => {
      console.error("[agent-loop] worker error", error instanceof Error ? error.message : error);
      return 0;
    });
    if (!processed) await new Promise((r) => setTimeout(r, pollMs));
  }
}
