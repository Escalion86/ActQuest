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
  typeof value === 'string'
    ? value.trim()
    : Number.isFinite(value)
      ? String(value).trim()
      : ''

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

const normalizeCode = (value) => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase()
  }

  if (Number.isFinite(value)) {
    return String(value).trim().toLowerCase()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const fromCode =
    (typeof value.code === 'string' && value.code.trim()) ||
    (Number.isFinite(value.code) ? String(value.code).trim() : '')
  if (fromCode) {
    return fromCode.toLowerCase()
  }

  const fromValue =
    (typeof value.value === 'string' && value.value.trim()) ||
    (Number.isFinite(value.value) ? String(value.value).trim() : '')
  if (fromValue) {
    return fromValue.toLowerCase()
  }

  const fromText =
    (typeof value.text === 'string' && value.text.trim()) ||
    (Number.isFinite(value.text) ? String(value.text).trim() : '')
  if (fromText) {
    return fromText.toLowerCase()
  }

  return ''
}

const normalizeIsoDate = (value) => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const normalizeCodeAttemptEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const taskIndex = Number(entry.taskIndex)
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    return null
  }

  const code = normalizeCode(entry.code)
  if (!code) {
    return null
  }

  const category = normalizeText(entry.category)
  const normalizedCategory =
    category === 'main' ||
    category === 'bonus' ||
    category === 'penalty' ||
    category === 'wrong'
      ? category
      : 'wrong'

  const status = normalizeText(entry.status)
  const normalizedStatus =
    status === 'accepted' || status === 'rejected' ? status : 'rejected'

  const source = normalizeText(entry.source)
  const normalizedSource = source === 'telegram' ? 'telegram' : 'web'

  return {
    taskIndex,
    code,
    category: normalizedCategory,
    status: normalizedStatus,
    source: normalizedSource,
    createdAt: normalizeIsoDate(entry.createdAt),
  }
}

const sortAttemptsByTime = (a, b) => {
  const aDate = a?.createdAt ? Date.parse(a.createdAt) : Number.NaN
  const bDate = b?.createdAt ? Date.parse(b.createdAt) : Number.NaN
  const aHasDate = Number.isFinite(aDate)
  const bHasDate = Number.isFinite(bDate)

  if (aHasDate && bHasDate) {
    return aDate - bDate
  }
  if (aHasDate && !bHasDate) {
    return -1
  }
  if (!aHasDate && bHasDate) {
    return 1
  }
  return 0
}

const normalizeCodesArray = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeCode(item))
    .filter(Boolean)

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
        taskFailurePenalty: 1,
        manyCodesPenalty: 1,
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
      const codeAttempts = Array.isArray(gt.codeAttempts)
        ? gt.codeAttempts.map(normalizeCodeAttemptEntry).filter(Boolean)
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

      const attemptsByTask = Array.from({ length: tasksCount }, (_, taskIndex) =>
        codeAttempts
          .filter((item) => item.taskIndex === taskIndex)
          .sort(sortAttemptsByTime),
      )

      const taskStats = Array.from({ length: tasksCount }, (_, taskIndex) => {
        const attempts = attemptsByTask[taskIndex]
        const mainCodesFound = normalizeCodesArray(findedCodes[taskIndex])
        const bonusCodesFound = normalizeCodesArray(findedBonusCodes[taskIndex])
        const penaltyCodesFound = normalizeCodesArray(
          findedPenaltyCodes[taskIndex],
        )
        const wrongCodesFound = normalizeCodesArray(wrongCodes[taskIndex])
        const taskSource = Array.isArray(game.tasks) ? game.tasks[taskIndex] : null
        const isCanceledTask = Boolean(taskSource?.canceled)
        const isBonusTask = Boolean(taskSource?.isBonusTask)
        const shouldCountInTotals = !isCanceledTask && !isBonusTask
        const hasConfiguredBonusCodes = Array.isArray(taskSource?.bonusCodes)
          ? taskSource.bonusCodes.length > 0
          : false
        const hasConfiguredPenaltyCodes = Array.isArray(taskSource?.penaltyCodes)
          ? taskSource.penaltyCodes.length > 0
          : false
        const penaltyByCodesSeconds = (Array.isArray(taskSource?.penaltyCodes)
          ? taskSource.penaltyCodes
          : []
        )
          .filter((item) => penaltyCodesFound.includes(normalizeCode(item?.code)))
          .reduce((acc, item) => acc + (Number(item?.penalty) || 0), 0)
        const bonusByCodesSeconds = (Array.isArray(taskSource?.bonusCodes)
          ? taskSource.bonusCodes
          : []
        )
          .filter((item) => bonusCodesFound.includes(normalizeCode(item?.code)))
          .reduce((acc, item) => acc + (Number(item?.bonus) || 0), 0)
        const manyCodesPenaltyLimit = Number(game?.manyCodesPenalty?.[0]) || 0
        const manyCodesPenaltySeconds = Number(game?.manyCodesPenalty?.[1]) || 0
        const taskFailurePenaltySecondsBase =
          Number(game?.taskFailurePenalty) || 0
        const penaltyByManyWrongSeconds =
          manyCodesPenaltyLimit > 0 && manyCodesPenaltySeconds > 0
            ? Math.floor(wrongCodesFound.length / manyCodesPenaltyLimit) *
              manyCodesPenaltySeconds
            : 0

        const startAt = normalizeIsoDate(startTime[taskIndex])
        const endAt = normalizeIsoDate(endTime[taskIndex])
        const startMs = startAt ? Date.parse(startAt) : Number.NaN
        const endMs = endAt ? Date.parse(endAt) : Number.NaN
        const nextStartAt = normalizeIsoDate(startTime[taskIndex + 1])
        const nextStartMs = nextStartAt ? Date.parse(nextStartAt) : Number.NaN
        const activeTaskIndexInt = Number.isInteger(activeNum) ? activeNum : 0

        let completedSeconds = null
        const normalizedTaskDuration = Math.max(0, Math.floor(taskDuration || 0))

        if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
          completedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000))
        } else if (
          Number.isFinite(startMs) &&
          Number.isFinite(nextStartMs) &&
          nextStartMs >= startMs
        ) {
          const diffByNextStart = Math.max(
            0,
            Math.floor((nextStartMs - startMs) / 1000),
          )
          completedSeconds =
            normalizedTaskDuration > 0
              ? Math.min(diffByNextStart, normalizedTaskDuration)
              : diffByNextStart
        } else if (Number.isFinite(startMs) && taskIndex < activeTaskIndexInt) {
          completedSeconds = normalizedTaskDuration
        } else if (Number.isFinite(startMs) && taskIndex === activeTaskIndexInt) {
          const elapsedForActiveTask = Math.max(
            0,
            Math.floor((Date.now() - startMs) / 1000),
          )
          completedSeconds =
            normalizedTaskDuration > 0
              ? Math.min(elapsedForActiveTask, normalizedTaskDuration)
              : elapsedForActiveTask
        }
        const isFailedTask =
          Number.isFinite(startMs) &&
          !Number.isFinite(endMs) &&
          (taskIndex < activeTaskIndexInt ||
            (Number.isFinite(completedSeconds) &&
              normalizedTaskDuration > 0 &&
              completedSeconds >= normalizedTaskDuration))
        const penaltyByTaskFailureSeconds =
          shouldCountInTotals && isFailedTask
            ? Math.max(0, taskFailurePenaltySecondsBase)
            : 0

        const enrichCodes = (codes, category) =>
          codes.map((code) => {
            const matched = attempts.find(
              (entry) =>
                entry.category === category &&
                entry.status === 'accepted' &&
                entry.code === code,
            )
            return {
              code,
              enteredAt: matched?.createdAt || null,
              source: matched?.source || null,
            }
          })

        const wrongAttemptsWithTime = attempts
          .filter((entry) => entry.status === 'rejected' || entry.category === 'wrong')
          .map((entry) => ({
            code: entry.code,
            enteredAt: entry.createdAt || null,
            source: entry.source || null,
          }))

        if (wrongAttemptsWithTime.length === 0 && wrongCodesFound.length > 0) {
          wrongCodesFound.forEach((code) => {
            wrongAttemptsWithTime.push({
              code,
              enteredAt: null,
              source: null,
            })
          })
        }

        return {
          taskIndex,
          taskTitle: normalizeText(game.tasks?.[taskIndex]?.title) || 'Без названия',
          startedAt: startAt,
          endedAt: endAt,
          completedSeconds,
          isFailedTask,
          penaltyByTaskFailureSeconds,
          penaltyByCodesSeconds,
          penaltyByManyWrongSeconds,
          bonusByCodesSeconds,
          hasConfiguredBonusCodes,
          hasConfiguredPenaltyCodes,
          mainCodes: enrichCodes(mainCodesFound, 'main'),
          bonusCodes: enrichCodes(bonusCodesFound, 'bonus'),
          penaltyCodes: enrichCodes(penaltyCodesFound, 'penalty'),
          wrongCodes: wrongAttemptsWithTime,
        }
      })

      const completedTasksCount = taskStats.filter(
        (task) => Number.isFinite(task.completedSeconds),
      ).length
      const totalTasksTimeSeconds = taskStats.reduce(
        (acc, task) => acc + (Number(task.completedSeconds) || 0),
        0,
      )
      const totalCodesPenaltySeconds = taskStats.reduce(
        (acc, task) =>
          acc +
          (Number(task.penaltyByTaskFailureSeconds) || 0) +
          (Number(task.penaltyByCodesSeconds) || 0) +
          (Number(task.penaltyByManyWrongSeconds) || 0),
        0,
      )
      const totalCodesBonusSeconds = taskStats.reduce(
        (acc, task) => acc + (Number(task.bonusByCodesSeconds) || 0),
        0,
      )
      const timeAddingsNormalized = Array.isArray(gt.timeAddings)
        ? gt.timeAddings
            .map((item) => {
              const seconds = Number(item?.time)
              if (!Number.isFinite(seconds) || seconds === 0) {
                return null
              }
              return {
                seconds,
                name: normalizeText(item?.name),
                taskIndex: Number.isInteger(item?.taskIndex) ? item.taskIndex : null,
              }
            })
            .filter(Boolean)
        : []
      const totalAddingsPenaltySeconds = timeAddingsNormalized.reduce(
        (acc, item) => (item.seconds > 0 ? acc + item.seconds : acc),
        0,
      )
      const totalAddingsBonusSeconds = timeAddingsNormalized.reduce(
        (acc, item) => (item.seconds < 0 ? acc + Math.abs(item.seconds) : acc),
        0,
      )
      const totalPenaltySeconds =
        totalCodesPenaltySeconds + totalAddingsPenaltySeconds
      const totalBonusSeconds = totalCodesBonusSeconds + totalAddingsBonusSeconds
      const totalFinalSeconds = Math.max(
        0,
        totalTasksTimeSeconds + totalPenaltySeconds - totalBonusSeconds,
      )
      const totalAcceptedCodesCount = taskStats.reduce(
        (acc, task) =>
          acc +
          task.mainCodes.length +
          task.bonusCodes.length +
          task.penaltyCodes.length,
        0,
      )
      const totalWrongCodesCount = taskStats.reduce(
        (acc, task) => acc + task.wrongCodes.length,
        0,
      )

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
        teamProgressStats: {
          completedTasksCount,
          totalTasksCount: tasksCount,
          totalTasksTimeSeconds,
          totalPenaltySeconds,
          totalBonusSeconds,
          totalFinalSeconds,
          totalCodesPenaltySeconds,
          totalCodesBonusSeconds,
          totalAddingsPenaltySeconds,
          totalAddingsBonusSeconds,
          totalAcceptedCodesCount,
          totalWrongCodesCount,
          tasks: taskStats,
        },
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
