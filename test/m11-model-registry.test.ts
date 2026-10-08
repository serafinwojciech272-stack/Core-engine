import test from "node:test";
import assert from "node:assert/strict";
import { getModelProfile, modelRegistry, modelRegistryReadiness, modelsForCapability, modelsForDomain } from "@/lib/m11-model-registry";

test("M11 exposes a typed OpenRouter model registry",()=>{const models=modelRegistry();assert.ok(models.length>=5);assert.ok(models.every(model=>model.provider==="openrouter"));assert.ok(models.every(model=>model.id&&model.capabilities.length>0));});
test("M11 selects models by capability and complexity",()=>{const coding=modelsForCapability("coding",8);assert.ok(coding.length>0);assert.ok(coding.every(model=>model.capabilities.includes("coding")));assert.deepEqual(modelsForDomain("coding",8),coding.map(model=>model.id));});
test("M11 keeps profile lookup deterministic",()=>{const profile=getModelProfile("anthropic/claude-sonnet-5.5");assert.equal(profile?.provider,"openrouter");assert.equal(profile?.supportsStructuredOutput,true);});
test("M11 readiness exposes no credential material",()=>{const readiness=modelRegistryReadiness();assert.equal(readiness.provider,"openrouter");assert.equal(typeof readiness.count,"number");assert.equal("secret" in readiness,false);});
