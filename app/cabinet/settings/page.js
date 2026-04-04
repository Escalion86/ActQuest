import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import SettingsPageClient from '@components/cabinet/app-router/SettingsPageClient'

export const metadata = { title: 'ActQuest — Управление сайтом' }

export const dynamic = 'force-dynamic'

export default async function CabinetSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/settings')}`,
    )
  }

  let initialSiteSettings = normalizeSiteSettings()

  try {
    const db = await dbConnectGlobal()

    if (db) {
      const SiteSettingsModel = db.model('SiteSettings')
      const settingsDoc = await SiteSettingsModel.findOne({}).lean()
      initialSiteSettings = normalizeSiteSettings(settingsDoc)
    }
  } catch (error) {
    console.error('Failed to load site settings', error)
  }

  return (
    <SettingsPageClient
      session={session}
      initialSiteSettings={initialSiteSettings}
    />
  )
}
