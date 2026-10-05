import { describe, expect, it } from "vitest";
import { PROGRAM_STAGES, createProgram } from "@/lib/program-engine";
describe("M136-M150 program bridge",()=>{it("contains 113-150",()=>expect(PROGRAM_STAGES.map(s=>s.id).slice(-38)).toEqual(Array.from({length:38},(_,i)=>113+i)));it("builds through readiness",()=>expect(createProgram("UAOS",{maxStages:100}).stages.at(-1)?.id).toBe(150));});
