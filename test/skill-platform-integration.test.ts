import test from "node:test";
import assert from "node:assert/strict";
import { getCoreSkills, listTools } from "@/lib/skills";

test("M11 initializes a shared skill and tool plane", () => {
  const skills = getCoreSkills();
  const tools = listTools();
  assert.ok(skills.some((skill) => skill.id === "trading.forex"));
  assert.ok(skills.some((skill) => skill.id === "web-builder"));
  assert.ok(skills.some((skill) => skill.id === "agent-builder"));
  assert.ok(tools.some((tool) => tool.id === "risk-engine"));
  assert.ok(tools.some((tool) => tool.id === "approval"));
});
