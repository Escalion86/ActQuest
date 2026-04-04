import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import canManageTransactions from '@helpers/canManageTransactions'
import { loadCabinetAppAdminTransactions } from '@app/cabinet/_lib/adminTransactionsServerData'
import AdminTransactionsPageClient from '@components/cabinet/app-router/AdminTransactionsPageClient'

export const metadata = { title: 'ActQuest — Транзакции' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminTransactionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/transactions')}`,
    )
  }

  if (!canManageTransactions({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const data = await loadCabinetAppAdminTransactions({ limit: 10 })

  return (
    <AdminTransactionsPageClient
      session={session}
      initialTransactions={data.transactions}
      initialHasMore={data.hasMore}
    />
  )
}
