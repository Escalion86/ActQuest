import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import {
  deleteTransaction,
  updateTransaction,
} from '@server/transactionsService'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user || !canManageTransactions({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : null
  if (!id) {
    return res.status(400).json({ success: false, error: 'Не указан id транзакции' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res
        .status(500)
        .json({ success: false, error: 'Не удалось подключиться к базе данных' })
    }

    if (req.method === 'PUT') {
      const payload = req.body?.data ?? req.body ?? {}
      const updated = await updateTransaction({
        db,
        transactionId: id,
        data: payload,
      })
      return res.status(200).json({ success: true, data: updated })
    }

    if (req.method === 'DELETE') {
      const deleted = await deleteTransaction({ db, transactionId: id })
      return res.status(200).json({ success: true, data: deleted })
    }

    res.setHeader('Allow', ['PUT', 'DELETE'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  } catch (error) {
    console.error('Transaction by id API error', error)
    return res
      .status(400)
      .json({ success: false, error: error?.message || 'Ошибка обработки запроса' })
  }
}
