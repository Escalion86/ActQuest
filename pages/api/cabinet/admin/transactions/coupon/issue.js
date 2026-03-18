import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { issueCoupon } from '@server/transactionsService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !canManageTransactions({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res
        .status(500)
        .json({ success: false, error: 'Не удалось подключиться к базе данных' })
    }

    const payload = req.body?.data ?? req.body ?? {}
    const created = await issueCoupon({
      db,
      data: {
        ...payload,
        location: payload.location || session?.user?.location || null,
      },
    })
    return res.status(201).json({ success: true, data: created })
  } catch (error) {
    console.error('Issue coupon API error', error)
    return res
      .status(400)
      .json({ success: false, error: error?.message || 'Не удалось выдать купон' })
  }
}
