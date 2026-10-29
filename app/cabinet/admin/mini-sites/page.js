import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { listSites } from '@server/miniSites/storage'
import MiniSitesPageClient from '@components/cabinet/app-router/MiniSitesPageClient'

export const metadata = { title: 'ActQuest — HTML мини-сайты' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function MiniSitesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/mini-sites')}`)
  if (!isUserAdmin({ role: session.user.role })) redirect('/cabinet')
  return <MiniSitesPageClient session={session} initialData={await listSites()} />
}
