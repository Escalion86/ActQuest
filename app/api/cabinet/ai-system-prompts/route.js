import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
const normalizeSection = (value) => normalizeText(value) || 'task_rich_editor'

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

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
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

    const requestUrl = new URL(request.url)
    const section = normalizeSection(requestUrl.searchParams.get('section'))

    const docs = await db
      .model('AiSystemPrompts')
      .find({ userId, section })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()

    return NextResponse.json(
      { success: true, data: docs.map(normalizePromptDoc) },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load AI system prompts', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить системные промпты' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
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
    const section = normalizeSection(body?.section)

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

    const created = await db.model('AiSystemPrompts').create({
      userId,
      title,
      promptMd,
      section,
    })

    return NextResponse.json(
      { success: true, data: normalizePromptDoc(created) },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create AI system prompt', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось создать системный промпт' },
      { status: 500 },
    )
  }
}
