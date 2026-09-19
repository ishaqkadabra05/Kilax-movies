import { NextRequest, NextResponse } from 'next/server'
import { MarzPayService } from '@/lib/marzpay'
export async function POST(req: NextRequest) { try { await MarzPayService.webhook(await req.json()); return NextResponse.json({status:'success'}) } catch(error){ console.error('MarzPay webhook:',error); return NextResponse.json({error:'Webhook processing failed'},{status:500}) } }
