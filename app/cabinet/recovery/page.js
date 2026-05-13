import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  normalizeEnvUrl,
  parseVkAppId,
} from '@helpers/vkIdClient'
import CabinetRegisterPageClient from '@components/cabinet/app-router/CabinetRegisterPageClient'
import { resolveAuthCallbackFromSearchParams } from '@app/cabinet/_lib/resolveAuthCallback'

export const metadata = { title: 'ActQuest — восстановление пароля' }

export const dynamic = 'force-dynamic'

export default async function CabinetRecoveryPage({ searchParams }) {
  const session = await getServerSession(authOptions)
  const headersList = await headers()
  const resolvedSearchParams = await searchParams

  const callbackState = resolveAuthCallbackFromSearchParams({
    searchParams: resolvedSearchParams,
    headersList,
    fallback: '/cabinet',
  })

  if (session?.user) {
    const destination =
      callbackState.isSafe && callbackState.relativeCallback
        ? callbackState.relativeCallback
        : '/cabinet'
    redirect(destination)
  }

  const currentMode = String(
    process.env.MODE ?? process.env.NODE_ENV ?? 'production',
  ).toLowerCase()
  const isVkAuthVisible = currentMode !== 'development'
  const vkidAppId = parseVkAppId(process.env.VK_ID_APP_ID)
  const vkidCallbackUrl =
    normalizeEnvUrl(process.env.VK_ID_REDIRECT_URI) ||
    normalizeEnvUrl(
      process.env.DOMAIN ? `${process.env.DOMAIN}/api/vk-id/callback` : '',
    )
  const vkidScope = process.env.VK_ID_SCOPE || 'phone email'

  return (
    <CabinetRegisterPageClient
      authCallbackUrl={callbackState.authCallbackUrl}
      authIntent="recovery"
      isVkAuthVisible={isVkAuthVisible}
      vkidAppId={vkidAppId}
      vkidCallbackUrl={vkidCallbackUrl}
      vkidScope={vkidScope}
    />
  )
}
