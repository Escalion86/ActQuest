import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import buildTaskDisplayContent from '@helpers/buildTaskDisplayContent'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : ''

const toFiniteNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalized = value.trim().toLowerCase()
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
    ? normalized
    : 'client'
}

const normalizeTaskForPreview = (task) => ({
  ...task,
  task: normalizeString(task?.task),
  taskRich: normalizeString(task?.taskRich),
  title: normalizeString(task?.title),
  clues: Array.isArray(task?.clues)
    ? task.clues.map((clue) => ({
        ...clue,
        clue: normalizeString(clue?.clue),
        clueRich: normalizeString(clue?.clueRich),
      }))
    : [],
  codes: Array.isArray(task?.codes)
    ? task.codes.map((code) => normalizeString(code)).filter(Boolean)
    : [],
  bonusCodes: Array.isArray(task?.bonusCodes) ? task.bonusCodes : [],
  penaltyCodes: Array.isArray(task?.penaltyCodes) ? task.penaltyCodes : [],
  postMessage: normalizeString(task?.postMessage),
  postMessageRich: normalizeString(task?.postMessageRich),
  postMessageMedia: Array.isArray(task?.postMessageMedia)
    ? task.postMessageMedia
    : [],
})

const toFiniteNonNegativeIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const normalized = Math.floor(numeric)
  return normalized >= 0 ? normalized : null
}

const buildTaskDisplayMeta = (task) => ({
  mainCodesCount: Array.isArray(task?.codes) ? task.codes.length : 0,
  requiredCodesCount: toFiniteNonNegativeIntegerOrNull(
    task?.numCodesToCompliteTask,
  ),
  bonusCodesCount: Array.isArray(task?.bonusCodes) ? task.bonusCodes.length : 0,
  penaltyCodesCount: Array.isArray(task?.penaltyCodes)
    ? task.penaltyCodes.length
    : 0,
})

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const requestUrl = new URL(request.url)
  const gameId = normalizeString(requestUrl.searchParams.get('gameId'))
  const taskIndex = toFiniteNonNegativeInteger(
    requestUrl.searchParams.get('taskIndex'),
    0,
  )

  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const game = await GamesModel.findById(gameId)
      .select({
        _id: 1,
        name: 1,
        type: 1,
        location: 1,
        status: 1,
        taskDuration: 1,
        cluesDuration: 1,
        breakDuration: 1,
        tasks: 1,
        moderators: 1,
      })
      .lean()

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const userRole = normalizeRole(session.user.role)
    const currentUserId = toStringId(
      session.user.globalUserId ?? session.user.userId ?? session.user._id,
    )
    if (
      !canAccessGameAsModerator({
        userRole,
        currentUserId,
        game,
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Нет доступа к предпросмотру этой игры' },
        { status: 403 },
      )
    }

    const tasks = Array.isArray(game.tasks) ? game.tasks : []
    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'В игре нет заданий для предпросмотра' },
        { status: 404 },
      )
    }

    const safeTaskIndex = Math.min(Math.max(taskIndex, 0), tasks.length - 1)
    const task = normalizeTaskForPreview(tasks[safeTaskIndex])
    const clues = Array.isArray(task.clues) ? task.clues : []

    const buildCombinedVariant = (cluesCountToShow) =>
      buildTaskDisplayContent({
        task,
        visibleCluesCount: cluesCountToShow,
      })

    const baseVariant = buildCombinedVariant(0)

    const variants = [
      {
        id: 'task',
        label: 'Текст задания',
        html: baseVariant.html,
        text: baseVariant.text,
      },
      ...clues.map((_, clueIndex) => ({
        id: `clue-${clueIndex + 1}`,
        label: `С подсказкой ${clueIndex + 1}`,
        ...buildCombinedVariant(clueIndex + 1),
      })),
    ]

    return NextResponse.json(
      {
        success: true,
        data: {
          game: {
            id: toStringId(game._id),
            name: normalizeString(game.name),
            type: game.type === 'photo' ? 'photo' : 'classic',
            location: normalizeString(game.location),
            status: normalizeString(game.status),
            taskDuration: Number(game.taskDuration) || 3600,
            cluesDuration: Number(game.cluesDuration) || 1200,
            breakDuration: Number(game.breakDuration) || 0,
            tasksCount: tasks.length,
          },
          task: {
            index: safeTaskIndex,
            title: normalizeString(task.title),
            postMessage: normalizeString(task.postMessage),
            postMessageRich: normalizeString(task.postMessageRich),
            postMessageMedia: Array.isArray(task.postMessageMedia)
              ? task.postMessageMedia
              : [],
            cluesCount: clues.length,
            displayMeta: buildTaskDisplayMeta(task),
          },
          variants,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to build game task preview', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось подготовить предпросмотр задания' },
      { status: 500 },
    )
  }
}
