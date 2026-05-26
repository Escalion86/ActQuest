import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import ensureArrayCapacity from '@helpers/ensureArrayCapacity'
import webGameProcess from '@server/webGameProcess'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }
  return ''
}

const normalizeAction = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

const forceCompleteActiveTask = async ({ GamesTeams, game, gameTeam }) => {
  const tasksCount = Array.isArray(game?.tasks) ? game.tasks.length : 0
  if (tasksCount <= 0) {
    return { success: false, message: 'В игре нет заданий.' }
  }

  const activeNumRaw = Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0
  if (activeNumRaw >= tasksCount) {
    return { success: false, message: 'Команда уже завершила игру.' }
  }
  const activeTaskIndex = Math.max(0, Math.min(activeNumRaw, tasksCount - 1))

  const startTime = ensureArrayCapacity(gameTeam?.startTime, tasksCount, null)
  const endTime = ensureArrayCapacity(gameTeam?.endTime, tasksCount, null)
  const forcedClues = ensureArrayCapacity(gameTeam?.forcedClues, tasksCount, 0)
  const breakDuration =
    Number.isFinite(game?.breakDuration) && game.breakDuration > 0
      ? Number(game.breakDuration)
      : 0

  const now = new Date()
  if (!startTime[activeTaskIndex]) {
    startTime[activeTaskIndex] = now
  }
  if (endTime[activeTaskIndex]) {
    return { success: false, message: 'Текущее задание уже завершено.' }
  }
  endTime[activeTaskIndex] = now

  const nextTaskIndex = activeTaskIndex + 1
  const updates = {
    startTime,
    endTime,
    forcedClues,
  }

  if (nextTaskIndex >= tasksCount) {
    updates.activeNum = nextTaskIndex
  } else if (breakDuration > 0) {
    forcedClues[nextTaskIndex] = 0
  } else {
    const nextStartTime = ensureArrayCapacity(startTime, tasksCount, null)
    nextStartTime[nextTaskIndex] = now
    updates.startTime = nextStartTime
    updates.activeNum = nextTaskIndex
    forcedClues[nextTaskIndex] = 0
  }

  await GamesTeams.findByIdAndUpdate(gameTeam._id, { $set: updates })

  return { success: true, message: 'Задание принудительно завершено.' }
}

const forceFailActiveTask = async ({ GamesTeams, game, gameTeam }) => {
  const tasksCount = Array.isArray(game?.tasks) ? game.tasks.length : 0
  if (tasksCount <= 0) {
    return { success: false, message: 'В игре нет заданий.' }
  }

  const activeNumRaw = Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0
  if (activeNumRaw >= tasksCount) {
    return { success: false, message: 'Команда уже завершила игру.' }
  }
  const activeTaskIndex = Math.max(0, Math.min(activeNumRaw, tasksCount - 1))

  const startTime = ensureArrayCapacity(gameTeam?.startTime, tasksCount, null)
  const endTime = ensureArrayCapacity(gameTeam?.endTime, tasksCount, null)
  const forcedClues = ensureArrayCapacity(gameTeam?.forcedClues, tasksCount, 0)
  const breakDuration =
    Number.isFinite(game?.breakDuration) && game.breakDuration > 0
      ? Number(game.breakDuration)
      : 0
  const taskDuration =
    Number.isFinite(game?.taskDuration) && game.taskDuration > 0
      ? Math.floor(Number(game.taskDuration))
      : 0

  if (endTime[activeTaskIndex]) {
    return { success: false, message: 'Текущее задание уже завершено.' }
  }

  const nowMs = Date.now()
  const consumedTaskTimeMs = taskDuration > 0 ? taskDuration * 1000 : 0
  // Провал должен учитываться как полная длительность задания.
  startTime[activeTaskIndex] = new Date(nowMs - consumedTaskTimeMs)
  endTime[activeTaskIndex] = null

  const nextTaskIndex = activeTaskIndex + 1
  const updates = {
    startTime,
    endTime,
    forcedClues,
  }

  if (nextTaskIndex >= tasksCount) {
    updates.activeNum = nextTaskIndex
  } else if (breakDuration > 0) {
    forcedClues[nextTaskIndex] = 0
  } else {
    startTime[nextTaskIndex] = new Date(nowMs)
    updates.activeNum = nextTaskIndex
    forcedClues[nextTaskIndex] = 0
  }

  await GamesTeams.findByIdAndUpdate(gameTeam._id, { $set: updates })

  return { success: true, message: 'Задание принудительно провалено.' }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Некорректное тело запроса' },
      { status: 400 },
    )
  }

  const gameId = normalizeStringId(payload?.gameId)
  const teamId = normalizeStringId(payload?.teamId)
  const action = normalizeAction(payload?.action)
  const code = normalizeStringId(payload?.code)

  if (!gameId || !teamId || !action) {
    return NextResponse.json(
      { success: false, error: 'Не переданы обязательные параметры' },
      { status: 400 },
    )
  }

  if (action === 'apply_code' && !code) {
    return NextResponse.json(
      { success: false, error: 'Не передан код для зачёта' },
      { status: 400 },
    )
  }

  const userRole =
    typeof session.user.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const GamesTeams = db.model('GamesTeams')

    const game = await Games.findById(gameId)
      .select({
        _id: 1,
        status: 1,
        location: 1,
        tasks: 1,
        taskDuration: 1,
        breakDuration: 1,
        moderators: 1,
      })
      .lean()

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const currentUserId = normalizeStringId(
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
        { success: false, error: 'Нет доступа к этой игре' },
        { status: 403 },
      )
    }

    if (game.status !== 'started') {
      return NextResponse.json(
        { success: false, error: 'Действие доступно только для запущенной игры' },
        { status: 400 },
      )
    }

    const gameTeam = await GamesTeams.findOne({
      gameId: gameId,
      $or: [{ _id: teamId }, { teamId: teamId }],
    }).lean()

    if (!gameTeam?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена в этой игре' },
        { status: 404 },
      )
    }

    const beforeHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizeStringId(game?._id ?? gameId),
      game,
    })

    if (action === 'apply_code') {
      const processResult = await webGameProcess({
        db,
        game,
        gameTeam,
        gameTeamId: gameTeam._id,
        location: game.location,
        message: code,
      })

      const summaryMessage =
        typeof processResult?.message === 'string' ? processResult.message : ''
      const lowered = summaryMessage.toLowerCase()
      if (
        lowered.includes('не верен') ||
        lowered.includes('уже найден') ||
        lowered.includes('уже нашли')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: summaryMessage || 'Не удалось зачесть код',
          },
          { status: 400 },
        )
      }

      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
      })
      await recordGameHistoryEntry({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
        location: game.location,
        actionType: 'game_updated',
        entityScope: 'game_teams',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary: `Администратор зачёл код для команды: ${code}`,
        },
      })

      return NextResponse.json({
        success: true,
        message: summaryMessage || 'Код зачтён',
      })
    }

    if (action === 'force_complete') {
      const result = await forceCompleteActiveTask({ GamesTeams, game, gameTeam })
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.message || 'Не удалось завершить задание' },
          { status: 400 },
        )
      }

      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
      })
      await recordGameHistoryEntry({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
        location: game.location,
        actionType: 'game_updated',
        entityScope: 'game_teams',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary: 'Администратор принудительно завершил текущее задание команды',
        },
      })
      return NextResponse.json({
        success: true,
        message: result.message || 'Задание принудительно завершено',
      })
    }

    if (action === 'force_fail') {
      const result = await forceFailActiveTask({ GamesTeams, game, gameTeam })
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.message || 'Не удалось провалить задание' },
          { status: 400 },
        )
      }

      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
      })
      await recordGameHistoryEntry({
        db,
        gameId: normalizeStringId(game?._id ?? gameId),
        location: game.location,
        actionType: 'game_updated',
        entityScope: 'game_teams',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary: 'Администратор принудительно провалил текущее задание команды',
        },
      })
      return NextResponse.json({
        success: true,
        message: result.message || 'Задание принудительно провалено',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Неизвестное действие' },
      { status: 400 },
    )
  } catch (error) {
    console.error('Failed to apply admin game status action', {
      error,
      gameId,
      teamId,
      action,
    })
    return NextResponse.json(
      { success: false, error: 'Не удалось выполнить действие' },
      { status: 500 },
    )
  }
}
