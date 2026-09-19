import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MarzPayService } from '@/lib/marzpay'
import { supabaseAdmin } from '@/lib/supabase'
import { giftTokenHash, verifyGiftToken } from '@/lib/gift-payment'
export async function POST(req: NextRequest) {
  try {
    const auth=req.headers.get('authorization')||''; const token=auth.startsWith('Bearer ')?auth.slice(7):''
    const client=token?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}}):null
    const {data:{user}}=client?await client.auth.getUser():{data:{user:null}}
    const {transactionId,subscriptionPlan,subscriptionDuration=30,giftToken}=await req.json(); if(!transactionId||!subscriptionPlan)return NextResponse.json({error:'Missing required fields'},{status:400});
    const gift=typeof giftToken==='string'?verifyGiftToken(giftToken):null
    if(!user&&!gift)return NextResponse.json({error:'Authentication required'},{status:401})
    let beneficiaryId=user?.id||gift?.recipientId||''
    if(gift){
      const {data:transaction}=await supabaseAdmin.from('transactions').select('user_id,metadata').eq('metadata->>marzpay_uuid',transactionId).maybeSingle() as {data:{user_id:string;metadata?:Record<string,string>}|null}
      if(!transaction||transaction.user_id!==gift.recipientId||transaction.metadata?.gift_token_hash!==giftTokenHash(giftToken))return NextResponse.json({error:'Invalid gift payment token'},{status:403})
      beneficiaryId=gift.recipientId
    }
    return NextResponse.json(await MarzPayService.activateSubscription(beneficiaryId,transactionId,subscriptionPlan,subscriptionDuration))
  } catch(error){ return NextResponse.json({error:error instanceof Error?error.message:'Subscription activation failed'},{status:500}) }
}
