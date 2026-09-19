import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
export async function GET(req:NextRequest){
 try{
  const auth=req.headers.get('authorization')||''; const token=auth.startsWith('Bearer ')?auth.slice(7):''; if(!token)return NextResponse.json({error:'Authentication required'},{status:401})
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}}); const {data:{user}}=await client.auth.getUser(); if(!user)return NextResponse.json({error:'Authentication required'},{status:401})
    const {data,error}=await (supabaseAdmin as any).rpc('get_kilax_download_status',{p_user_id:user.id}); if(error)return NextResponse.json({data:null,unavailable:true}); return NextResponse.json({data:Array.isArray(data)?data[0]:data})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Download status unavailable'},{status:500})}
}
