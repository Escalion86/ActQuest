import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }
  return ''
}

const normalizeText = (value) =>
  typeof value === 'string'
    ? value.trim()
    : Number.isFinite(value)
      ? String(value).trim()
      : ''

const isElevatedRole = (role) => role === 'admin' || role === 'dev'
const isModeratorRole = (role) => role === 'moder'

const normalizeChecks = (checksRaw) => {
  if (checksRaw && typeof checksRaw.get === 'function') {
    return Array.from(checksRaw.entries()).reduce((acc, [key, value]) => {
      acc[String(key)] = Boolean(value)
      return acc
    }, {})
  }

  if (checksRaw && typeof checksRaw === 'object') {
    return Object.keys(checksRaw).reduce((acc, key) => {
      acc[String(key)] = Boolean(checksRaw[key])
      return acc
    }, {})
  }

  return {}
}

const normalizePhotoEntry = (entry) => ({
  photos: Array.isArray(entry?.photos)
    ? entry.photos.map((item) => normalizeText(item)).filter(Boolean)
    : [],
  checks: normalizeChecks(entry?.checks),
})

const ensurePhotoEntries = (photos, tasksCount) => {
  const entries = Array.isArray(photos) ? photos.map(normalizePhotoEntry) : []
  while (entries.length < tasksCount) {
    entries.push({ photos: [], checks: {} })
  }
  return entries.slice(0, tasksCount)
}

const buildAccessResult = ({ session, game }) => {
  const role =
    typeof session?.user?.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  if (isElevatedRole(role)) {
    return { allowed: true }
  }

  if (!isModeratorRole(role)) {
    return { allowed: false, status: 403, error: 'Недостаточно прав' }
  }

  const currentUserId = normalizeStringId(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )
  const moderatorIds = Array.isArray(game?.moderators)
    ? game.moderators.map((item) => normalizeStringId(item?._id ?? item))
    : []

  if (!currentUserId || !moderatorIds.includes(currentUserId)) {
    return { allowed: false, status: 403, error: 'Нет доступа к этой игре' }
  }

  return { allowed: true }
}

const buildTaskPayload = (task, index) => ({
  taskIndex: index,
  title: normalizeText(task?.title) || `Задание ${index + 1}`,
  taskBonusForComplite: Number(task?.taskBonusForComplite) || 0,
  subTasks: Array.isArray(task?.subTasks)
    ? task.subTasks.map((subTask) => ({
        id: toStringId(subTask?._id),
        name: normalizeText(subTask?.name),
        task: normalizeText(subTask?.task),
        bonus: Number(subTask?.bonus) || 0,
      }))
    : [],
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
  const gameId = normalizeStringId(requestUrl.searchParams.get('gameId'))

  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const Games = db.model('Games')
    const GamesTeams = db.model('GamesTeams')
    const Teams = db.model('Teams')

    const game = await Games.findById(gameId)
      .select({
        _id: 1,
        name: 1,
        type: 1,
        status: 1,
        tasks: 1,
        moderators: 1,
        hideResult: 1,
      })
      .lean()

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const access = buildAccessResult({ session, game })
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      )
    }

    if (game.type !== 'photo') {
      return NextResponse.json(
        { success: false, error: 'Это не фотоквест' },
        { status: 400 },
      )
    }

    const tasks = Array.isArray(game.tasks) ? game.tasks : []
    const gameTeams = await GamesTeams.find({ gameId }).lean()
    const teamIds = gameTeams
      .map((gameTeam) => normalizeStringId(gameTeam?.teamId))
      .filter(Boolean)
    const teams =
      teamIds.length > 0
        ? await Teams.find({ _id: { $in: teamIds } })
            .select({ _id: 1, name: 1 })
            .lean()
        : []
    const teamsById = new Map(
      teams.map((team) => [normalizeStringId(team?._id), team]),
    )

    const teamsPayload = gameTeams
      .map((gameTeam) => {
        const teamId = normalizeStringId(gameTeam?.teamId)
        const team = teamsById.get(teamId)
        return {
          gameTeamId: normalizeStringId(gameTeam?._id),
          teamId,
          teamName: normalizeText(team?.name) || 'Без названия',
          activeTaskIndex: Number.isInteger(gameTeam?.activeNum)
            ? gameTeam.activeNum
            : 0,
          photos: ensurePhotoEntries(gameTeam?.photos, tasks.length),
        }
      })
      .sort((first, second) =>
        first.teamName.localeCompare(second.teamName, 'ru'),
      )

    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: normalizeStringId(game._id),
          name: normalizeText(game.name),
          status: normalizeText(game.status),
          type: game.type,
          hideResult: Boolean(game.hideResult),
        },
        tasks: tasks.map(buildTaskPayload),
        teams: teamsPayload,
      },
    })
  } catch (error) {
    console.error('Failed to fetch photo review data', { error, gameId })
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить фото для проверки' },
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

  const payload = (await request.json().catch(() => ({}))) || {}
  const gameId = normalizeStringId(payload.gameId)
  const gameTeamId = normalizeStringId(payload.gameTeamId)
  const taskIndex = Number(payload.taskIndex)
  const checkKey = normalizeStringId(payload.checkKey)
  const checked = Boolean(payload.checked)

  if (
    !gameId ||
    !gameTeamId ||
    !Number.isInteger(taskIndex) ||
    taskIndex < 0 ||
    !checkKey
  ) {
    return NextResponse.json(
      { success: false, error: 'Не переданы обязательные параметры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const Games = db.model('Games')
    const GamesTeams = db.model('GamesTeams')

    const game = await Games.findById(gameId)
      .select({ _id: 1, type: 1, tasks: 1, moderators: 1 })
      .lean()

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const access = buildAccessResult({ session, game })
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      )
    }

    if (game.type !== 'photo') {
      return NextResponse.json(
        { success: false, error: 'Это не фотоквест' },
        { status: 400 },
      )
    }

    const tasks = Array.isArray(game.tasks) ? game.tasks : []
    const task = tasks[taskIndex]
    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Задание не найдено' },
        { status: 404 },
      )
    }

    const allowedCheckKeys = new Set([
      'accepted',
      ...(Array.isArray(task.subTasks)
        ? task.subTasks.map((subTask) => toStringId(subTask?._id)).filter(Boolean)
        : []),
    ])
    if (!allowedCheckKeys.has(checkKey)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный параметр проверки' },
        { status: 400 },
      )
    }

    const gameTeam = await GamesTeams.findOne({ _id: gameTeamId, gameId }).lean()
    if (!gameTeam?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена в этой игре' },
        { status: 404 },
      )
    }

    const photos = ensurePhotoEntries(gameTeam.photos, tasks.length)
    photos[taskIndex].checks = {
      ...photos[taskIndex].checks,
      [checkKey]: checked,
    }

    await GamesTeams.findByIdAndUpdate(gameTeam._id, {
      $set: { photos },
    })

    return NextResponse.json({
      success: true,
      data: {
        checks: photos[taskIndex].checks,
      },
    })
  } catch (error) {
    console.error('Failed to update photo review check', {
      error,
      gameId,
      gameTeamId,
      taskIndex,
      checkKey,
    })
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить проверку фото' },
      { status: 500 },
    )
  }
}
