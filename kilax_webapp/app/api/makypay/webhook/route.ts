import { NextResponse } from 'next/server'
export async function GET(){ return NextResponse.json({error:'This payment endpoint is disabled. Please use the active payment flow.'},{status:410}) }
export async function POST(){ return NextResponse.json({error:'This payment endpoint is disabled. Please use the active payment flow.'},{status:410}) }
