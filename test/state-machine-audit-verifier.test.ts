import test from "node:test";
import assert from "node:assert/strict";

const transitions:Record<string,string[]>={
  DISCOVERED:["DIAGNOSED","EXPIRED"],DIAGNOSED:["PROPOSED","FAILED"],PROPOSED:["AWAITING_APPROVAL","EXPIRED"],
  AWAITING_APPROVAL:["APPROVED","REJECTED","EXPIRED"],APPROVED:["EXECUTING","REJECTED"],
  EXECUTING:["MEASURING","FAILED"],MEASURING:["COMPLETED","FAILED"],COMPLETED:["LEARNED"],FAILED:["APPROVED","REJECTED"],
};
function verify(chain:Array<[string,string]>){
  let current:string|undefined;
  for(const [from,to] of chain){
    assert.ok(transitions[from]?.includes(to));
    if(current!==undefined) assert.equal(from,current);
    current=to;
  }
}
test("governed happy path is valid",()=>verify([
  ["DISCOVERED","DIAGNOSED"],["DIAGNOSED","PROPOSED"],["PROPOSED","AWAITING_APPROVAL"],
  ["AWAITING_APPROVAL","APPROVED"],["APPROVED","EXECUTING"],["EXECUTING","MEASURING"],
  ["MEASURING","COMPLETED"],["COMPLETED","LEARNED"],
]));
test("failed execution can only return through approval",()=>verify([["EXECUTING","FAILED"],["FAILED","APPROVED"],["APPROVED","EXECUTING"]]));
test("direct failed to executing is invalid",()=>assert.equal(transitions.FAILED.includes("EXECUTING"),false));
test("measuring cannot return to approval",()=>assert.equal(transitions.MEASURING.includes("APPROVED"),false));
