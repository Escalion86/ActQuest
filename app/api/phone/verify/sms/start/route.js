import { startPhoneVerification } from '@server/phoneVerification'

export async function POST(request) {
  return startPhoneVerification(request, { smsOnly: true })
}
