import { authorizeTenant } from "@/lib/http";
import { NextResponse } from "next/server";
const FALLBACK={source:"fallback",queue:[],billing:[],checked_at:new Date().toISOString()};
export async function GET(request:Request){
  const auth = await authorizeTenant(request, { allowAnonymous: false }); if (!auth.ok) return auth.response;
 
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const tenantId=process.env.FCC_TENANT_ID;
 if(!base||!key||!tenantId)return NextResponse.json(FALLBACK);
 try{
  const h={apikey:key,Authorization:"Bearer "+key};
  const [q,b]=await Promise.all([
   fetch(base+"/rest/v1/ce_fcc_operational_queue?tenant_id=eq."+tenantId+"&select=*&order=due_at.asc.nullslast&limit=50",{headers:h,cache:"no-store"}),
   fetch(base+"/rest/v1/ce_fcc_billing_control?tenant_id=eq."+tenantId+"&select=*&order=due_date.asc.nullslast&limit=50",{headers:h,cache:"no-store"})
  ]);
  if(!q.ok||!b.ok)throw new Error("Supabase query failed");
  return NextResponse.json({source:"live",queue:await q.json(),billing:await b.json(),checked_at:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json(FALLBACK)}
}