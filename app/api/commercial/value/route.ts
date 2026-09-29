import {NextResponse} from "next/server";
import {guardMutation} from "@/lib/http";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {createValueCase,listValueCases} from "@/lib/commercial-storage";

function finite(value:unknown){return typeof value==="number"&&Number.isFinite(value)}
function bodyNumber(body:Record<string,unknown>,key:string){const value=body[key];return finite(value)?value:Number.NaN}

export async function GET(request:Request){
  try{
    const runtime=await resolveSaaSContext(request);
    const tenantId=runtime.identity?.tenantId??runtime.legacyTenant?.tenantId;
    if(!tenantId)return NextResponse.json({ok:false,error:"TENANT_REQUIRED"},{status:401});
    const cases=await listValueCases(tenantId,50);
    return NextResponse.json({ok:true,cases,durable:cases.durable,items:cases.items});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"VALUE_CASE_READ_FAILED"},{status:503});
  }
}

export async function POST(request:Request){
  const guard=guardMutation(request,"commercial-value");
  if(guard)return guard;
  try{
    const runtime=await resolveSaaSContext(request);
    const tenantId=runtime.identity?.tenantId??runtime.legacyTenant?.tenantId;
    if(!tenantId)return NextResponse.json({ok:false,error:"TENANT_REQUIRED"},{status:401});
    const body=await request.json() as Record<string,unknown>;
    const name=typeof body.name==="string"?body.name.trim().slice(0,200):"";
    const currency=typeof body.currency==="string"?body.currency.trim().toUpperCase():"";
    const baselineValue=bodyNumber(body,"baselineValue");
    const targetValue=body.targetValue==null?null:bodyNumber(body,"targetValue");
    const actualValue=body.actualValue==null?null:bodyNumber(body,"actualValue");
    const investmentValue=body.investmentValue==null?0:bodyNumber(body,"investmentValue");
    const missionId=body.missionId==null?null:(typeof body.missionId==="string"?body.missionId.trim():null);
    if(!name||!/^[A-Z]{3}$/.test(currency)||!finite(baselineValue)||baselineValue<0||(targetValue!==null&&!finite(targetValue))||(actualValue!==null&&!finite(actualValue))||!finite(investmentValue)||investmentValue<0){
      return NextResponse.json({ok:false,error:"INVALID_VALUE_CASE"},{status:400});
    }
    const item=await createValueCase({tenantId,missionId,name,currency,baselineValue,targetValue,actualValue,investmentValue});
    return NextResponse.json({ok:true,case:item}, {status:201});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"VALUE_CASE_WRITE_FAILED"},{status:503});
  }
}
