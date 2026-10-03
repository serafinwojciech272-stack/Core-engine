import test from "node:test";
import assert from "node:assert/strict";

type AuditEvent={seq:number;hash:string;prev:string|null;correlationId:string};

function verify(events:AuditEvent[]){
  let expectedPrev:null|string=null;
  for(let i=0;i<events.length;i++){
    assert.equal(events[i].seq,i+1);
    assert.equal(events[i].prev,expectedPrev);
    assert.ok(events[i].correlationId.trim());
    expectedPrev=events[i].hash;
  }
  return true;
}

test("audit sequence and hash links are monotonic",()=>{
  assert.equal(verify([
    {seq:1,hash:"a",prev:null,correlationId:"c"},
    {seq:2,hash:"b",prev:"a",correlationId:"c"},
    {seq:3,hash:"c",prev:"b",correlationId:"c"}
  ]),true);
});

test("audit verifier detects sequence gaps",()=>{
  assert.throws(()=>verify([
    {seq:1,hash:"a",prev:null,correlationId:"c"},
    {seq:3,hash:"c",prev:"a",correlationId:"c"}
  ]));
});

test("audit verifier requires correlation identity",()=>{
  assert.throws(()=>verify([
    {seq:1,hash:"a",prev:null,correlationId:""}
  ]));
});
