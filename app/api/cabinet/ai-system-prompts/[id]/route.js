import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const resolveSessionUserId = async (sessionUser, db) => {
  const userFilter = resolveSessionUserFilter(sessionUser)
  if (!userFilter) {
    return null
  }

  const user = await db.model('Users').findOne(userFilter).select({ _id: 1 }).lean()
  return user?._id ? String(user._id) : null
}

const normalizePromptDoc = (doc) => ({
  id: doc?._id ? String(doc._id) : '',
  title: typeof doc?.title === 'string' ? doc.title : '',
  promptMd: typeof doc?.promptMd === 'string' ? doc.promptMd : '',
  section: typeof doc?.section === 'string' ? doc.section : 'task_rich_editor',
  createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
  updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
})

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const promptId = normalizeText(resolvedParams?.id)
  if (!promptId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор промпта' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const userId = await resolveSessionUserId(session.user, db)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 400 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const title = normalizeText(body?.title).slice(0, 120)
    const promptMd = normalizeText(body?.promptMd).slice(0, 20000)

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Укажите заголовок системного промпта' },
        { status: 400 },
      )
    }

    if (!promptMd) {
      return NextResponse.json(
        { success: false, error: 'Введите текст системного промпта' },
        { status: 400 },
      )
    }

    const updated = await db
      .model('AiSystemPrompts')
      .findOneAndUpdate(
        { _id: promptId, userId },
        { $set: { title, promptMd } },
        { returnDocument: 'after' },
      )
      .lean()

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Системный промпт не найден' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data: normalizePromptDoc(updated) },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to update AI system prompt', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить системный промпт' },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const promptId = normalizeText(resolvedParams?.id)
  if (!promptId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор промпта' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const userId = await resolveSessionUserId(session.user, db)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 400 },
      )
    }

    const deleted = await db
      .model('AiSystemPrompts')
      .findOneAndDelete({ _id: promptId, userId })
      .lean()

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Системный промпт не найден' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data: { id: String(deleted._id) } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to delete AI system prompt', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось удалить системный промпт' },
      { status: 500 },
    )
  }
}
