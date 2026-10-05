import { NextResponse } from "next/server";
import { createSkillManifest,createSkillRegistry,discoverSkills,semanticSkillMatch,composeSkills,buildDependencyGraph,verifySkill,generateSkillEvidence,learnSkill,detectSkillRegression,certifySkill,registerSkill,controlPlaneDecision } from "@/lib/universal-skill-intelligence";
import { guardMutation } from "@/lib/http";

export async function GET(){return NextResponse.json({ok:true,service:"universal-skill-intelligence",version:"usi-v1",stages:"176-200",executionPolicy:"HUMAN_APPROVAL_REQUIRED"});}
export async function POST(request:Request){
 const guard=guardMutation(request,"universal-skill-intelligence");if(guard)return guard;
 try{
  const b=await request.json(),action=String(b.action||"status");
  if(action==="create")return NextResponse.json({ok:true,skill:createSkillManifest(b.skill)});
  if(action==="registry")return NextResponse.json({ok:true,registry:createSkillRegistry(Array.isArray(b.skills)?b.skills.map((x:any)=>createSkillManifest(x)):[])});
  const skills=Array.isArray(b.skills)?b.skills.map((x:any)=>createSkillManifest(x)):[]; 
  if(action==="discover")return NextResponse.json({ok:true,results:discoverSkills(createSkillRegistry(skills),String(b.query||""),b.domain)});
  if(action==="match")return NextResponse.json({ok:true,score:skills.map((s:any)=>({id:s.id,score:semanticSkillMatch(s,String(b.objective||""))}))});
  if(action==="compose")return NextResponse.json({ok:true,composition:composeSkills(skills),dependencies:buildDependencyGraph(skills)});
  if(action==="verify"){const s=skills.find((x:any)=>x.id===String(b.skillId));if(!s)return NextResponse.json({ok:false,error:"SKILL_NOT_FOUND"},{status:404});return NextResponse.json({ok:true,verification:verifySkill(s,Array.isArray(b.observed)?b.observed:[],Array.isArray(b.evidence)?b.evidence:[]),evidence:generateSkillEvidence(s,b.observed||[],b.sources||[])});}
  if(action==="learn"){let r=createSkillRegistry(skills);r=learnSkill(r,String(b.skillId),String(b.version||"1.0.0"),Number(b.outcome||0),Number(b.cost||0),Number(b.latency||0));return NextResponse.json({ok:true,registry:r});}
  if(action==="regression"){return NextResponse.json({ok:true,regression:detectSkillRegression(b.current,b.baseline)});}
  if(action==="certify"){const s=skills.find((x:any)=>x.id===String(b.skillId));if(!s)return NextResponse.json({ok:false,error:"SKILL_NOT_FOUND"},{status:404});return NextResponse.json({ok:true,certification:certifySkill(s,b.performance)});}
  if(action==="control"){return NextResponse.json({ok:true,decision:controlPlaneDecision({objective:String(b.objective||""),skills,context:new Set(Array.isArray(b.context)?b.context:[]),approved:b.approved===true,budget:Number(b.budget??0)})});}
  if(action==="register"){let r=createSkillRegistry();return NextResponse.json({ok:true,registry:registerSkill(r,skills[0])});}
  return NextResponse.json({ok:false,error:"UNKNOWN_SKILL_ACTION"},{status:400});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"SKILL_ENGINE_FAILED"},{status:400});}
}