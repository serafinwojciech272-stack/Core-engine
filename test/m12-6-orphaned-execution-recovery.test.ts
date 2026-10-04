import { afterEach, describe, expect, it } from "vitest";
import {
  detectOrphanedAgentExecutions,
  reconcileOrphanedAgentExecution
} from "@/lib/skills/agent-execution-enforcement";

const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_SECRET_KEY;

afterEach(() => {
  if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
});

describe("M12.6 orphaned executor recovery", () => {
  it("fails closed when persistent state is unavailable", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(detectOrphanedAgentExecutions()).rejects.toThrow("PERSISTENT_STATE_REQUIRED");
    const result = await reconcileOrphanedAgentExecution({
      recoveryId: "r",
      resolution: "NO_SIDE_EFFECT",
      actorId: "system",
      reason: "lease expired"
    });
    expect(result.resolved).toBe(false);
    expect(result.result).toBe("PERSISTENT_STATE_REQUIRED");
  });

  it("rejects reconciliation without mandatory scope", async () => {
    process.env.SUPABASE_URL = "https://m12-6.invalid";
    process.env.SUPABASE_SECRET_KEY = "test";
    const result = await reconcileOrphanedAgentExecution({
      recoveryId: "",
      resolution: "NO_SIDE_EFFECT",
      actorId: "system",
      reason: "lease expired"
    });
    expect(result.resolved).toBe(false);
    expect(result.result).toBe("RECOVERY_RECONCILIATION_SCOPE_REQUIRED");
  });

  it("rejects invalid detector limits locally", async () => {
    process.env.SUPABASE_URL = "https://m12-6.invalid";
    process.env.SUPABASE_SECRET_KEY = "test";
    await expect(detectOrphanedAgentExecutions(0)).resolves.toEqual([]);
  });
});
