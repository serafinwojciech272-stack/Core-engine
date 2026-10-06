import { describe, expect, it } from "vitest";
import { EXECUTION_MESH_STAGES, createSession, approveSession, readyTasks, startExecution, recordTaskResult, recoverFailedTasks, reapproveAfterRecovery, meshHealth, certifyExecutionMesh } from "@/lib/universal-agent-execution-mesh";

describe("M151-M175 Universal Agent Execution Mesh", () => {
  it("defines the complete execution mesh", () => expect(EXECUTION_MESH_STAGES.map(x => x[0])).toEqual(Array.from({length:25}, (_, i) => 151 + i)));
  it("blocks execution before approval", () => {
    const s = createSession("run-1", [{id:"a",capability:"research",dependencies:[]}]);
    expect(s.executionPermission).toBe(false);
    expect(() => startExecution(s, ["a"])).toThrow("HUMAN_APPROVAL_REQUIRED");
  });
  it("executes independent tasks and respects dependency barriers", () => {
    let s = approveSession(createSession("run-2", [
      {id:"a",capability:"research",dependencies:[]}, {id:"b",capability:"build",dependencies:[]}, {id:"c",capability:"verify",dependencies:["a","b"]}
    ]));
    expect(readyTasks(s).map(t => t.id)).toEqual(["a","b"]);
    s = startExecution(s,["a","b"]);
    s = recordTaskResult(s,"a",true,["e-a"],"a-ok");
    s = recordTaskResult(s,"b",true,["e-b"],"b-ok");
    expect(readyTasks(s).map(t => t.id)).toEqual(["c"]);
  });
  it("revokes permission on failure and requires reapproval", () => {
    let s = approveSession(createSession("run-3", [{id:"a",capability:"execute",dependencies:[]}]));
    s = startExecution(s,["a"]);
    s = recordTaskResult(s,"a",false,["provider-timeout"]);
    expect(s.executionPermission).toBe(true);
    s = recoverFailedTasks(s);
    expect(s.executionPermission).toBe(false);
    s = reapproveAfterRecovery(s);
    expect(s.executionPermission).toBe(true);
  });
  it("certifies only after complete measured execution", () => {
    let s = approveSession(createSession("run-4", [{id:"a",capability:"execute",dependencies:[]}]));
    s = startExecution(s,["a"]);
    s = recordTaskResult(s,"a",true,["verified"],"success");
    expect(meshHealth(s).completion).toBe(1);
    expect(certifyExecutionMesh(s).certified).toBe(true);
  });
});
