import {createHash} from "node:crypto";
import type {LlmMessage} from "@/lib/cognition/llm-client";
export type CognitionPromptName="UNDERSTAND"|"DECIDE"|"LEARN";
export type CognitionPrompt={name:CognitionPromptName;version:string;system:string;userTemplate:string;hash:string};
const defs:Record<CognitionPromptName,Omit<CognitionPrompt,"hash">>={
UNDERSTAND:{name:"UNDERSTAND",version:"1.0.0",system:"Extract business signals from unstructured input. Do not invent facts; mark uncertainty.",userTemplate:"Return JSON only: summary, signals, requirements, deadlines, criteria, unknowns, confidence_notes. INPUT: {{input}}"},
DECIDE:{name:"DECIDE",version:"1.0.0",system:"Synthesize language only. The deterministic decision is authoritative. Never alter confidence, priority, probabilities, expectedR, riskGate or evidence.",userTemplate:"Return JSON only: diagnosis, recommendation. CONTEXT: {{context}} DECISION: {{decision}}"},
LEARN:{name:"LEARN",version:"1.0.0",system:"Draft a reusable lesson. Do not promote memory, alter strategy state, or bypass human approval.",userTemplate:"Return JSON only: lesson, evidence, conditions, limitations, follow_up_test. OUTCOME: {{outcome}}"}};
const prompts=Object.fromEntries(Object.entries(defs).map(([k,v])=>[k,{...v,hash:createHash("sha256").update(JSON.stringify(v)).digest("hex")}])) as Record<CognitionPromptName,CognitionPrompt>;
export function getCognitionPrompt(name:CognitionPromptName){return prompts[name]}
export function renderCognitionPrompt(name:CognitionPromptName,values:Record<string,string>){const prompt=prompts[name];let user=prompt.userTemplate;for(const [k,v] of Object.entries(values))user=user.replaceAll("{{"+k+"}}",v);return{prompt,messages:[{role:"system",content:prompt.system},{role:"user",content:user}] satisfies LlmMessage[]}}
