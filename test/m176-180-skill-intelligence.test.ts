import test from "node:test";
import assert from "node:assert/strict";
import {validateSkillContract, toSkillManifestV2, discoverSkills, composeSkills} from "../lib/skill-intelligence";

const base = {
  id:"security.audit", version:"1.0.0", name:"Security Audit",
  description:"Threat and release audit", domains:["security","release"],
  capabilities:["OBSERVE","TRANSFORM"] as const, risk:"HIGH" as const,
  inputSchema:{required:["target"],properties:{target:"string"}},
  outputSchema:{required:["report"],properties:{report:"object"}},
  preconditions:["target is reachable"], postconditions:["findings are recorded"],
  dependencies:[], tags:["security","audit","qa"]
};

test("M176 validates contracts and enforces high-risk guards",()=>{
  assert.equal(validateSkillContract(base).valid,true);
  assert.equal(validateSkillContract({...base,preconditions:[]}).valid,false);
});

test("M177 produces a manifest v2 with trust and cost metadata",()=>{
  const manifest=toSkillManifestV2(base,{publisher:"core-engine",trust:"VERIFIED",evidence:["e1"],cost:{latencyMs:120,credits:2},reliability:.98});
  assert.equal(manifest.manifestVersion,"2.0");
  assert.equal(manifest.reliability,.98);
});

test("M178 discovers skills from objective signals",()=>{
  const manifest=toSkillManifestV2(base,{publisher:"core-engine",trust:"VERIFIED",evidence:[],cost:{latencyMs:10,credits:1},reliability:.9});
  assert.equal(discoverSkills("security audit release",[manifest])[0].skillId,"security.audit");
});

test("M179+M180 composes dependencies and reports missing nodes",()=>{
  const root=toSkillManifestV2({...base,id:"research",name:"Research",risk:"LOW",preconditions:[],postconditions:[],dependencies:[]},{publisher:"core-engine",trust:"VERIFIED",evidence:[],cost:{latencyMs:1,credits:1},reliability:1});
  const dependent=toSkillManifestV2({...base,id:"proposal",name:"Proposal",risk:"LOW",preconditions:[],postconditions:[],dependencies:["research"]},{publisher:"core-engine",trust:"VERIFIED",evidence:[],cost:{latencyMs:1,credits:1},reliability:1});
  const plan=composeSkills("build proposal",[root,dependent]);
  assert.deepEqual(plan.edges,[{from:"research",to:"proposal"}]);
  assert.deepEqual(plan.unresolved,[]);
});
