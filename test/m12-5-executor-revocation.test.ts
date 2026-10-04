import { afterEach, describe, expect, it } from "vitest";
import { revokePersistentAgentExecution } from "@/lib/skills/agent-execution-enforcement";

const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_SECRET_KEY;

afterEach(() => {
  if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
});

describe("M12.5 executor revocation", () => {
  it("fails closed when revocation scope is incomplete", async () => {
    process.env.SUPABASE_URL = "https://m12-5.invalid";
    process.env.SUPABASE_SECRET_KEY = "test";
    const result = await revokePersistentAgentExecution({
      compositionId: "c",
      authorizationId: "a",
      reason: " "
    });
    expect(result.revoked).toBe(false);
    expect(result.reason).toBe("EXECUTOR_REVOCATION_SCOPE_REQUIRED");
  });

  it("fails closed without persistent state", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    const result = await revokePersistentAgentExecution({
      compositionId: "c",
      authorizationId: "a",
      reason: "operator safety stop"
    });
    expect(result.revoked).toBe(false);
    expect(result.reason).toBe("PERSISTENT_STATE_REQUIRED");
  });
});
