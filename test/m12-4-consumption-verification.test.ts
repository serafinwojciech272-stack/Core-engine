import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyPersistentAgentExecutionConsumption } from "@/lib/skills/agent-execution-enforcement";

const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_SECRET_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
});

describe("M12.4 executor consumption", () => {
  it("fails closed without persistent state", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    const result = await verifyPersistentAgentExecutionConsumption({
      compositionId: "c", authorizationId: "a", tenantId: "t", missionId: "m",
      capabilityId: "cap", correlationId: "corr", skillId: "skill",
      skillVersion: "1.0.0", mode: "LIVE", expectedResult: "SUCCESS"
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("PERSISTENT_STATE_REQUIRED");
  });

  it("rejects incomplete scope before persistence", async () => {
    process.env.SUPABASE_URL = "https://m12-4.invalid";
    process.env.SUPABASE_SECRET_KEY = "test";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await verifyPersistentAgentExecutionConsumption({
      compositionId: "c", authorizationId: "", tenantId: "t", missionId: "m",
      capabilityId: "cap", correlationId: "corr", skillId: "skill",
      skillVersion: "1.0.0", mode: "LIVE", expectedResult: "SUCCESS"
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("EXECUTOR_CONSUMPTION_SCOPE_REQUIRED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
