import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    source: 'app-router',
    timestamp: new Date().toISOString(),
  })
}

