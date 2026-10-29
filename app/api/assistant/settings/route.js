import { assistantSettingsResponse } from '@server/assistant/settings.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  return assistantSettingsResponse(request.signal)
}
