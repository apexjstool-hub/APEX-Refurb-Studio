// Supabase Edge Function: enable JWT verification when deploying.
// Set SUPABASE_URL and SUPABASE_ANON_KEY using Supabase project environment.
import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (request) => {
 const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
 const fail = (code:number,message:string) => new Response(JSON.stringify({ok:false,error:message}),{status:code,headers});
 if (request.method !== 'POST') return fail(405,'POST required');
 const authorization=request.headers.get('Authorization')||'';
 if (!/^Bearer\s+\S+$/.test(authorization)) return fail(401,'Staff login required');
 const url=Deno.env.get('SUPABASE_URL')||'';
 const key=Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(!url||!key)return fail(503,'Cloud intake not configured');
 const sb=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userResult,error:authError}=await sb.auth.getUser(authorization.replace(/^Bearer\s+/i,''));
 if(authError||!userResult.user)return fail(401,'Invalid or expired staff session');
 let body:Record<string,unknown>;
 try{const raw=await request.text();if(raw.length>350000)return fail(413,'Report too large');body=JSON.parse(raw);}catch{return fail(400,'Invalid JSON');}
 if(!body||Array.isArray(body)||typeof body!=='object')return fail(400,'Invalid report');
 const source=body.source, eventId=body.eventId, assetId=body.assetId, report=body.report;
 if(!['diagnostics','refurbflow'].includes(String(source))||typeof eventId!=='string'||typeof assetId!=='string'||!report||typeof report!=='object'||Array.isArray(report))return fail(400,'Missing required fields');
 const {data,error}=await sb.rpc('apex_receive_device_intake',{
   p_source:source,p_event_id:eventId,p_asset_id:assetId,p_report:report});
 if(error)return fail(error.code==='42501'?403:error.code==='22023'?400:409,error.message);
 return new Response(JSON.stringify(data),{status:200,headers});
});
