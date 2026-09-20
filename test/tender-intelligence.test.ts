import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTenderCase, fingerprintDataset } from "../lib/tender-intelligence-engine.ts";

const doc=(name:string,text:string)=>({name,format:"txt",bytes:text.length,sha256:"sha-"+name,text,markdown:text,headings:[],tables:[],source:"uploaded" as const});

test("tender intelligence normalizes facts, risks and questions deterministically",()=>{
 const dataset=normalizeTenderCase("Z154/68879",[
  doc("ogloszenie.pdf","Termin składania 12.10.2026 09:00. Wadium 4 000 000 PLN. 36 miesięcy. Poziom recyklingu 45%."),
  doc("PPU.doc","§15 kara umowna. Waloryzacja. Elektromobilność. Poziom recyklingu 50%.")
 ]);
 assert.equal(dataset.caseId,"Z154/68879");
 assert.ok(dataset.risks.length>=2);
 assert.ok(dataset.questions.some(q=>q.priority==="P1"));
 assert.equal(dataset.bidReadiness.status,"NOT_READY");
 assert.equal(fingerprintDataset(dataset),fingerprintDataset(dataset));
});
