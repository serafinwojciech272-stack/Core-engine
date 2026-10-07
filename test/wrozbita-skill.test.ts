import test from "node:test";
import assert from "node:assert/strict";
import { registerBuiltInSkillPacks, getSkillPack, getSkillAdapter, executeSkillAction, clearSkillRuntimeForTests } from "@/lib/skill-runtime";

test("wrozbita skill is registered and classifies relationship questions", async () => {
  clearSkillRuntimeForTests();
  registerBuiltInSkillPacks();
  const pack = getSkillPack("wrozbita-ai");
  const adapter = getSkillAdapter("core.wrozbita.v1");
  assert.ok(pack);
  assert.ok(adapter);
  assert.equal(adapter?.observationalOnly, true);
  const result = await executeSkillAction({
    skillId:"wrozbita-ai",
    actionId:"wrozbita.question.classify",
    permissions:["OBSERVE"],
    approved:true,
    payload:{question:"Czy mój były do mnie wróci?"}
  });
  assert.equal(result.status,"EXECUTED");
  assert.equal(result.output?.domain,"LOVE");
});

test("wrozbita draw is deterministic for the same question", async () => {
  clearSkillRuntimeForTests();
  registerBuiltInSkillPacks();
  const run = () => executeSkillAction({
    skillId:"wrozbita-ai",
    actionId:"wrozbita.cards.draw",
    permissions:["OBSERVE"],
    approved:true,
    payload:{question:"Czy warto do niego napisać?",count:3}
  });
  const a = await run();
  const b = await run();
  assert.equal(a.status,"EXECUTED");
  assert.deepEqual(a.output?.cards,b.output?.cards);
});