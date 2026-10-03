import { describe, expect, it } from "vitest";
import { enforcePersistentAgentExecution } from "@/lib/skills/agent-execution-enforcement";

describe("M12.3 executor scope lock", () => {
  it("fails closed when persistent storage is unavailable", async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    try {
      const result = await enforcePersistentAgentExecution({
        compositionId: "composition",
        tenantId: "tenant",
        missionId: "mission",
        capabilityId: "capability",
        correlationId: "correlation",
        skillId: "skill",
        skillVersion: "1.0.0",
        mode: "LIVE"
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("PERSISTENT_STATE_REQUIRED");
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
    }
  });

  it("fails closed when executor scope is incomplete", async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_URL = "https://scope-lock.invalid";
    process.env.SUPABASE_SECRET_KEY = "test";
    try {
      const result = await enforcePersistentAgentExecution({
        compositionId: "composition",
        tenantId: "tenant",
        missionId: "mission",
        capabilityId: "capability",
        correlationId: "correlation"
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("EXECUTOR_SCOPE_REQUIRED");
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
    }
  });
});
