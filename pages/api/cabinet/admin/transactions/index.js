import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { createTransaction } from '@server/transactionsService'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

export default async function handler(req, res) {
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

    const Transactions = db.model('Transactions')

    if (req.method === 'GET') {
      const offset = parsePositiveInteger(req.query?.offset, 0)
      const limit = parsePositiveInteger(req.query?.limit, 20)

      const query = {}
      if (typeof req.query?.direction === 'string' && req.query.direction) {
        query.direction = req.query.direction
      }
      if (typeof req.query?.status === 'string' && req.query.status) {
        query.status = req.query.status
      }

      const docs = await Transactions.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit + 1)
        .lean()

      const hasMore = docs.length > limit
      const data = hasMore ? docs.slice(0, limit) : docs

      return res.status(200).json({
        success: true,
        data,
        meta: { offset, limit, hasMore },
      })
    }

    if (req.method === 'POST') {
      const payload = req.body?.data ?? req.body ?? {}
      const created = await createTransaction({ db, data: payload })
      return res.status(201).json({ success: true, data: created })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  } catch (error) {
    console.error('Transactions API error', error)
    return res
      .status(400)
      .json({ success: false, error: error?.message || 'Ошибка обработки транзакции' })
  }
}
