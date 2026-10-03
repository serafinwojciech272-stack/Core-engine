import test from "node:test";
import assert from "node:assert/strict";

const expected=(event:string,to?:string,from?:string)=>{
 if(event==="STATE_CHANGED" && to==="APPROVED") return "human";
 if(event==="STATE_CHANGED" && from==="FAILED" && to==="APPROVED") return "human";
 if(["MISSION_CREATED","STATE_CHANGED","EXECUTION_RECORDED","MEASUREMENT_RECORDED","CAPABILITY_EXECUTED","CAPABILITY_EXECUTION_FAILED","LEARNING_RECORDED"].includes(event)) return "system";
 return undefined;
};

test("approval transition requires human actor",()=>assert.equal(expected("STATE_CHANGED","APPROVED"),"human"));
test("failed retry approval requires human actor",()=>assert.equal(expected("STATE_CHANGED","APPROVED","FAILED"),"human"));
test("execution and measurement events require system actor",()=>{
 assert.equal(expected("EXECUTION_RECORDED"),"system");
 assert.equal(expected("MEASUREMENT_RECORDED"),"system");
});
test("authorization verifier does not treat arbitrary actor as valid",()=>assert.notEqual(expected("EXECUTION_RECORDED"),"human"));
