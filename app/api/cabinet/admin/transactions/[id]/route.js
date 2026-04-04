import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { deleteTransaction, updateTransaction } from '@server/transactionsService'

const checkAccess = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user || !canManageTransactions({ role: session.user.role })) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      ),
      session,
    }
  }
  return { ok: true, session }
}

const getId = (params) => (typeof params?.id === 'string' ? params.id : null)

export async function PUT(request, { params }) {
  const access = await checkAccess()
  if (!access.ok) {
    return access.response
  }

  const id = getId(params)
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Не указан id транзакции' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 500 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const payload = body?.data ?? body ?? {}
    const updated = await updateTransaction({
      db,
      transactionId: id,
      data: payload,
    })
    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (error) {
    console.error('Transaction by id PUT API error (app)', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка обработки запроса' },
      { status: 400 },
    )
  }
}

export async function DELETE(request, { params }) {
  const access = await checkAccess()
  if (!access.ok) {
    return access.response
  }

  const id = getId(params)
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Не указан id транзакции' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 500 },
      )
    }

    const deleted = await deleteTransaction({ db, transactionId: id })
    return NextResponse.json({ success: true, data: deleted }, { status: 200 })
  } catch (error) {
    console.error('Transaction by id DELETE API error (app)', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка обработки запроса' },
      { status: 400 },
    )
  }
}
