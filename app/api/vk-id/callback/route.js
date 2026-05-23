import { NextResponse } from 'next/server'
import buildVkCallbackHtml from '@helpers/buildVkCallbackHtml'

export async function GET() {
  return new NextResponse(buildVkCallbackHtml(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
