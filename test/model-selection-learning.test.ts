import { strict as assert } from "node:assert";
import { rankModelObservations, selectModel } from "../lib/model-selection-learning";

const ranked = rankModelObservations([
  {modelKey:"model-a",taskClass:"research",outcomeQuality:"VERIFIED",success:true,confidence:.9},
  {modelKey:"model-a",taskClass:"research",outcomeQuality:"VERIFIED",success:true,confidence:.8},
  {modelKey:"model-b",taskClass:"research",outcomeQuality:"VERIFIED",success:true,confidence:.7},
  {modelKey:"model-b",taskClass:"research",outcomeQuality:"NEGATIVE",success:false,confidence:.4},
]);
assert.equal(ranked[0].modelKey,"model-a");
assert.equal(selectModel(ranked,"research")?.modelKey,"model-a");
assert.equal(selectModel(ranked,"unknown"),null);
