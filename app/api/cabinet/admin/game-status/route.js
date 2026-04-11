import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { toStringId } from '@helpers/idAndDate'
import getSecondsBetween from '@helpers/getSecondsBetween'
import dbConnectGlobal from '@utils/dbConnectGlobal'

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

const isElevatedRole = (role) => role === 'admin' || role === 'dev'
const isModeratorRole = (role) => role === 'moder'

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeCodeEntry = (value) => {
  if (typeof value === 'string') {
    const code = value.trim()
    return code ? { code, image: '' } : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const code =
    normalizeText(value.code) ||
    normalizeText(value.value) ||
    normalizeText(value.text)
  if (!code) {
    return null
  }

  return {
    code,
    image: normalizeText(value.image),
  }
}

const normalizeTaskPreview = (task, index) => {
  const clues = Array.isArray(task?.clues)
    ? task.clues.map((clue) => ({
        clue: normalizeText(clue?.clue),
        clueRich: normalizeText(clue?.clueRich),
      }))
    : []

  const mainCodes = Array.isArray(task?.codes)
    ? task.codes
        .map((item) => normalizeText(item))
        .filter(Boolean)
    : []

  const codePhotos = Array.isArray(task?.codePhotos)
    ? task.codePhotos.map((item) => normalizeText(item)).slice(0, mainCodes.length)
    : []

  const bonusCodes = Array.isArray(task?.bonusCodes)
    ? task.bonusCodes.map(normalizeCodeEntry).filter(Boolean)
    : []

  const penaltyCodes = Array.isArray(task?.penaltyCodes)
    ? task.penaltyCodes.map(normalizeCodeEntry).filter(Boolean)
    : []

  return {
    id: normalizeText(task?.id) || `task-${index + 1}`,
    title: normalizeText(task?.title),
    task: normalizeText(task?.task),
    taskRich: normalizeText(task?.taskRich),
    howToSolve: normalizeText(task?.howToSolve),
    coordinates: task?.coordinates || null,
    clues,
    codes: mainCodes,
    codePhotos,
    bonusCodes,
    penaltyCodes,
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const userRole =
    typeof session.user.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  const requestUrl = new URL(request.url)
  const gameId = requestUrl.searchParams.get('gameId')

  if (!gameId || typeof gameId !== 'string' || !gameId.trim()) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const GamesModel = db.model('Games')
    const GamesTeamsModel = db.model('GamesTeams')
    const TeamsModel = db.model('Teams')

    const game = await GamesModel.findById(gameId.trim())
      .select({
        _id: 1,
        name: 1,
        status: 1,
        type: 1,
        dateStartFact: 1,
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

    // Проверка доступа: admin/dev или модератор игры
    if (!isElevatedRole(userRole)) {
      if (isModeratorRole(userRole)) {
        const currentUserId = normalizeStringId(
          session.user.globalUserId ?? session.user.userId ?? session.user._id,
        )
        const moderatorIds = Array.isArray(game.moderators)
          ? game.moderators.map((m) => normalizeStringId(m?._id ?? m))
          : []
        if (!moderatorIds.includes(currentUserId)) {
          return NextResponse.json(
            { success: false, error: 'Нет доступа к этой игре' },
            { status: 403 },
          )
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав' },
          { status: 403 },
        )
      }
    }

    if (game.status !== 'started') {
      return NextResponse.json(
        { success: false, error: 'Игра должна быть в процессе' },
        { status: 400 },
      )
    }

    const taskDuration = game.taskDuration ?? 3600
    const cluesDuration = game.cluesDuration ?? 1200
    const breakDuration = game.breakDuration ?? 0
    const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0

    const gameTeams = await GamesTeamsModel.find({
      gameId: gameId.trim(),
    }).lean()
    const teamIds = gameTeams
      .map((gt) => toStringId(gt?.teamId))
      .filter(Boolean)

    const teams =
      teamIds.length > 0
        ? await TeamsModel.find({ _id: { $in: teamIds } })
            .select({ _id: 1, name: 1 })
            .lean()
        : []

    const teamsById = teams.reduce((acc, t) => {
      acc[toStringId(t._id)] = t
      return acc
    }, {})

    const now = new Date()

    const teamsStatus = gameTeams.map((gt) => {
      const teamId = toStringId(gt.teamId)
      const team = teamsById[teamId]
      const activeNum = gt.activeNum ?? 0
      const startTime = Array.isArray(gt.startTime) ? gt.startTime : []
      const endTime = Array.isArray(gt.endTime) ? gt.endTime : []
      const findedCodes = Array.isArray(gt.findedCodes) ? gt.findedCodes : []
      const wrongCodes = Array.isArray(gt.wrongCodes) ? gt.wrongCodes : []
      const findedBonusCodes = Array.isArray(gt.findedBonusCodes)
        ? gt.findedBonusCodes
        : []
      const findedPenaltyCodes = Array.isArray(gt.findedPenaltyCodes)
        ? gt.findedPenaltyCodes
        : []
      const photos = Array.isArray(gt.photos) ? gt.photos : []

      let startedTasks = 0
      startTime.forEach((t) => {
        if (t) {
          startedTasks += 1
        }
      })

      const activeTaskIndex = activeNum
      const currentFindedCodes = findedCodes[activeTaskIndex] ?? []
      const currentWrongCodes = wrongCodes[activeTaskIndex] ?? []
      const currentBonusCodes = findedBonusCodes[activeTaskIndex] ?? []
      const currentPenaltyCodes = findedPenaltyCodes[activeTaskIndex] ?? []

      const isActiveTaskFinished =
        activeTaskIndex >= tasksCount ||
        Boolean(endTime[activeTaskIndex]) ||
        (startTime[activeTaskIndex]
          ? getSecondsBetween(startTime[activeTaskIndex], now) > taskDuration
          : false)

      const isAllTasksStarted =
        startTime.length === tasksCount &&
        startTime.filter(Boolean).length === tasksCount
      const isTeamFinished = isAllTasksStarted && isActiveTaskFinished
      const isTeamOnBreak =
        Boolean(breakDuration) && isActiveTaskFinished && !isTeamFinished

      const isActiveTaskFailed = isActiveTaskFinished
        ? !endTime[activeTaskIndex]
        : false

      // Суммарное время
      let sumTimeSeconds = 0
      for (let i = 0; i <= activeTaskIndex && i < startTime.length; i += 1) {
        if (!startTime[i]) {
          continue
        }
        if (i === activeTaskIndex) {
          if (isActiveTaskFinished && endTime[i]) {
            sumTimeSeconds += getSecondsBetween(startTime[i], endTime[i])
          } else if (isActiveTaskFinished) {
            sumTimeSeconds += taskDuration
          } else {
            sumTimeSeconds += getSecondsBetween(startTime[i], now)
          }
        } else if (endTime[i]) {
          sumTimeSeconds += getSecondsBetween(startTime[i], endTime[i])
        } else {
          sumTimeSeconds += taskDuration
        }
      }

      // Время на текущем задании
      let currentTaskSeconds = 0
      if (startTime[activeTaskIndex] && !isActiveTaskFinished) {
        currentTaskSeconds = getSecondsBetween(startTime[activeTaskIndex], now)
      }

      // Перерыв
      let breakTimeLeftSeconds = 0
      if (isTeamOnBreak) {
        const finishTime = endTime[activeTaskIndex]
          ? new Date(endTime[activeTaskIndex])
          : startTime[activeTaskIndex]
            ? new Date(
                new Date(startTime[activeTaskIndex]).getTime() +
                  taskDuration * 1000,
              )
            : now
        const afterEnd = getSecondsBetween(finishTime, now)
        breakTimeLeftSeconds = Math.max(0, breakDuration - afterEnd)
      }
      const isBreakFinishedWaitingForNextTask =
        isTeamOnBreak && breakTimeLeftSeconds <= 0

      // Время завершения текущего (предыдущего для периода перерыва) задания
      let completedTaskSeconds = 0
      if (startTime[activeTaskIndex] && isActiveTaskFinished) {
        if (endTime[activeTaskIndex]) {
          completedTaskSeconds = getSecondsBetween(
            startTime[activeTaskIndex],
            endTime[activeTaskIndex],
          )
        } else {
          completedTaskSeconds = taskDuration
        }
      }

      // Подсказки на текущем задании
      let cluesReceived = 0
      if (
        cluesDuration > 0 &&
        currentTaskSeconds > 0 &&
        !isActiveTaskFinished
      ) {
        cluesReceived = Math.floor(currentTaskSeconds / cluesDuration)
      }

      // Название текущего задания
      const currentTaskTitle =
        activeTaskIndex < tasksCount && Array.isArray(game.tasks)
          ? (game.tasks[activeTaskIndex]?.title ?? '')
          : ''
      const nextTaskTitle =
        startedTasks < tasksCount && Array.isArray(game.tasks)
          ? (game.tasks[startedTasks]?.title ?? '')
          : ''

      // Фото для photo-игр
      const currentPhotosCount =
        game.type === 'photo' && photos[activeTaskIndex]
          ? Array.isArray(photos[activeTaskIndex]?.photos)
            ? photos[activeTaskIndex].photos.length
            : 0
          : 0

      return {
        teamId,
        teamName: team?.name ?? 'Без названия',
        activeTaskIndex,
        startedTasks,
        currentTaskTitle,
        nextTaskTitle,
        findedCodesCount: currentFindedCodes.length,
        findedCodes: currentFindedCodes,
        wrongCodesCount: currentWrongCodes.length,
        wrongCodes: currentWrongCodes,
        bonusCodesCount: currentBonusCodes.length,
        bonusCodes: currentBonusCodes,
        penaltyCodesCount: currentPenaltyCodes.length,
        penaltyCodes: currentPenaltyCodes,
        isTeamFinished,
        isTeamOnBreak,
        isActiveTaskFinished,
        isActiveTaskFailed,
        sumTimeSeconds,
        currentTaskSeconds,
        breakTimeLeftSeconds,
        completedTaskSeconds,
        isBreakFinishedWaitingForNextTask,
        cluesReceived,
        currentPhotosCount,
      }
    })

    // Сортировка как в Telegram
    teamsStatus.sort((a, b) => {
      if (b.activeTaskIndex !== a.activeTaskIndex) {
        return b.activeTaskIndex - a.activeTaskIndex
      }
      if (a.isTeamFinished || b.isTeamFinished) {
        if (a.isTeamFinished && !b.isTeamFinished) return -1
        if (!a.isTeamFinished && b.isTeamFinished) return 1
        return a.sumTimeSeconds - b.sumTimeSeconds
      }
      if (a.isTeamOnBreak || b.isTeamOnBreak) {
        if (a.isTeamOnBreak && !b.isTeamOnBreak) return -1
        if (!a.isTeamOnBreak && b.isTeamOnBreak) return 1
      }
      if (b.findedCodesCount !== a.findedCodesCount) {
        return b.findedCodesCount - a.findedCodesCount
      }
      return 0
    })

    const taskTitles = Array.isArray(game.tasks)
      ? game.tasks.map((t) => t?.title ?? '')
      : []
    const tasksPreview = Array.isArray(game.tasks)
      ? game.tasks.map((task, index) => normalizeTaskPreview(task, index))
      : []

    return NextResponse.json(
      {
        success: true,
        data: {
          gameId: toStringId(game._id),
          gameName: game.name ?? '',
          gameType: game.type ?? 'classic',
          dateStartFact: game.dateStartFact ?? null,
          taskDuration,
          cluesDuration,
          breakDuration,
          tasksCount,
          taskTitles,
          tasks: tasksPreview,
          teams: teamsStatus,
          serverTime: now.toISOString(),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game status', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить статус игры' },
      { status: 500 },
    )
  }
}
