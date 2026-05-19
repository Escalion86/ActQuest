import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { toStringId } from '@helpers/idAndDate'
import getSecondsBetween from '@helpers/getSecondsBetween'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { fetchUnreadTeamMessageCounts } from '@server/gameTeamMessages'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'

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
    return code ? { code, image: '', description: '' } : null
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
    description: normalizeText(value.description),
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
    numCodesToCompliteTask:
      task?.numCodesToCompliteTask ?? task?.numCodesToCompleteTask ?? null,
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

const normalizeTaskFailureEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const taskIndex = Number(entry.taskIndex)
  const failedAt = normalizeIsoDate(entry.failedAt)
  if (!Number.isInteger(taskIndex) || taskIndex < 0 || !failedAt) {
    return null
  }

  const source = normalizeText(entry.source)
  const normalizedSource =
    source === 'admin' || source === 'system' || source === 'timeout'
      ? source
      : 'captain'

  return {
    taskIndex,
    taskId: normalizeText(entry.taskId),
    failedAt,
    source: normalizedSource,
    reason: normalizeText(entry.reason),
  }
}

const getTaskIdValue = (task) =>
  task?._id !== null && task?._id !== undefined ? String(task._id) : ''

const isCaptainForceClueAdding = (adding) => {
  const source = normalizeText(adding?.source)
  const name = normalizeText(adding?.name)
  return source === 'captain_force_clue' || name.startsWith('Досрочная подсказка')
}

const hasTimeAddingTaskBinding = (adding) => {
  const hasTaskId =
    typeof adding?.taskId === 'string' && adding.taskId.trim() !== ''
  const hasTaskIndex = Number.isInteger(Number(adding?.taskIndex))
  return hasTaskId || hasTaskIndex
}

const normalizeTimeAddingScope = (adding) => {
  const scope = normalizeText(adding?.scope)
  if (scope === 'task_elapsed') return 'task_elapsed'
  if (scope === 'total_adjustment') return 'total_adjustment'
  return isCaptainForceClueAdding(adding) && hasTimeAddingTaskBinding(adding)
    ? 'task_elapsed'
    : 'total_adjustment'
}

const shouldShowTimeAddingInAdjustments = (adding) => {
  const scope = normalizeTimeAddingScope(adding)
  if (isCaptainForceClueAdding(adding)) return false
  if (scope === 'total_adjustment') return true
  if (typeof adding?.showInAdjustments === 'boolean') {
    return adding.showInAdjustments
  }
  return !isCaptainForceClueAdding(adding)
}

const isTimeAddingForTask = (adding, taskIndex, task) => {
  const taskId = getTaskIdValue(task)
  if (taskId && adding?.taskId) return String(adding.taskId) === taskId
  return Number.isInteger(Number(adding?.taskIndex)) &&
    Number(adding.taskIndex) === taskIndex
}

const getTaskElapsedAdjustmentSeconds = ({ timeAddings, taskIndex, task }) => {
  const addings = Array.isArray(timeAddings) ? timeAddings : []
  return addings.reduce((sum, adding) => {
    if (normalizeTimeAddingScope(adding) !== 'task_elapsed') return sum
    if (!isTimeAddingForTask(adding, taskIndex, task)) return sum
    const seconds = Number(adding?.time)
    return Number.isFinite(seconds) ? sum + Math.round(seconds) : sum
  }, 0)
}

const getClueAdvanceSecondsForTask = ({ timeAddings, taskIndex, task }) => {
  const addings = Array.isArray(timeAddings) ? timeAddings : []

  return addings.reduce((sum, adding) => {
    if (!isCaptainForceClueAdding(adding)) return sum

    if (!isTimeAddingForTask(adding, taskIndex, task)) return sum

    const seconds = Number(adding?.time)
    return Number.isFinite(seconds) && seconds > 0 ? sum + seconds : sum
  }, 0)
}

const getForcedClueAddingsCountForTask = ({ timeAddings, taskIndex, task }) => {
  const addings = Array.isArray(timeAddings) ? timeAddings : []

  return addings.filter((adding) => {
    if (!isCaptainForceClueAdding(adding)) return false
    return isTimeAddingForTask(adding, taskIndex, task)
  }).length
}

const toDateValue = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const cloneDateValue = (value) => {
  const date = toDateValue(value)
  return date ? new Date(date.getTime()) : null
}

const ensureArrayLength = (value, length, fallback = null) => {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length }, (_, index) =>
    index < source.length ? source[index] : fallback,
  )
}

const normalizeTaskFailuresForUpdate = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const taskIndex = Number(item?.taskIndex)
          const failedAt = toDateValue(item?.failedAt)
          if (!Number.isInteger(taskIndex) || taskIndex < 0 || !failedAt) {
            return null
          }

          const source = normalizeText(item?.source)
          const normalizedSource =
            source === 'admin' || source === 'system' || source === 'timeout'
              ? source
              : 'captain'

          return {
            taskIndex,
            taskId: normalizeText(item?.taskId),
            failedAt,
            source: normalizedSource,
            reason: normalizeText(item?.reason),
          }
        })
        .filter(Boolean)
    : []

const getTaskFailureForIndex = (gameTeam, taskIndex) =>
  normalizeTaskFailuresForUpdate(gameTeam?.taskFailures).find(
    (item) => item.taskIndex === taskIndex,
  ) || null

const syncGameTeamProgressForStatus = async ({
  game,
  gameTeam,
  gamesTeamsModel,
  now = new Date(),
}) => {
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const tasksCount = tasks.length
  if (!gameTeam || tasksCount === 0) return gameTeam

  const taskDuration = Math.max(0, Number(game?.taskDuration) || 3600)
  const breakDuration = Math.max(0, Number(game?.breakDuration) || 0)
  const nowDate = toDateValue(now) || new Date()
  const nowMs = nowDate.getTime()

  const getEffectiveElapsedSeconds = (teamState, taskIndex, startAt) => {
    const startDate = toDateValue(startAt)
    if (!startDate) return 0

    const realElapsed = Math.max(
      Math.floor((nowMs - startDate.getTime()) / 1000),
      0,
    )

    return (
      realElapsed +
      getClueAdvanceSecondsForTask({
        timeAddings: teamState?.timeAddings,
        taskIndex,
        task: tasks[taskIndex],
      })
    )
  }

  const getTimeoutFailedAt = (teamState, taskIndex, startAt) => {
    const startDate = toDateValue(startAt)
    if (!startDate) return null

    const clueAdvance = getClueAdvanceSecondsForTask({
      timeAddings: teamState?.timeAddings,
      taskIndex,
      task: tasks[taskIndex],
    })

    return new Date(
      startDate.getTime() + Math.max(taskDuration - clueAdvance, 0) * 1000,
    )
  }

  const buildTimeoutFailureUpdates = (teamState, taskIndex, failedAt) => {
    const existingFailures = normalizeTaskFailuresForUpdate(
      teamState?.taskFailures,
    )
    const hasExistingFailure = existingFailures.some(
      (item) => item.taskIndex === taskIndex,
    )

    if (hasExistingFailure || !failedAt) {
      return {}
    }

    return {
      taskFailures: [
        ...existingFailures,
        {
          taskIndex,
          taskId: getTaskIdValue(tasks[taskIndex]),
          failedAt,
          source: 'timeout',
          reason: 'task_timeout',
        },
      ],
    }
  }

  const updateTeam = async (teamState, updates) => {
    if (!updates || Object.keys(updates).length === 0) {
      return teamState
    }

    const updatedTeam = await gamesTeamsModel
      .findByIdAndUpdate(teamState._id, updates, { returnDocument: 'after' })
      .lean()

    return updatedTeam ?? { ...teamState, ...updates }
  }

  const advanceToNextTask = async (
    teamState,
    nextIndex,
    startedAt,
    extraUpdates = {},
  ) => {
    const startTimeUpdates = ensureArrayLength(
      teamState.startTime,
      tasksCount,
      null,
    ).map(cloneDateValue)
    startTimeUpdates[nextIndex] = toDateValue(startedAt) || nowDate

    const forcedCluesUpdates = ensureArrayLength(
      teamState.forcedClues,
      tasksCount,
      0,
    ).map((value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : 0
    })
    forcedCluesUpdates[nextIndex] = 0

    return updateTeam(teamState, {
      ...extraUpdates,
      activeNum: nextIndex,
      startTime: startTimeUpdates,
      forcedClues: forcedCluesUpdates,
    })
  }

  const progressOnce = async (teamState) => {
    const activeNum = Number.isInteger(teamState?.activeNum)
      ? teamState.activeNum
      : 0
    if (activeNum >= tasksCount) return teamState

    const taskIndex = Math.max(Math.min(activeNum, tasksCount - 1), 0)
    const nextIndex = taskIndex + 1
    const hasNextTask = nextIndex < tasksCount
    const startTimes = ensureArrayLength(teamState.startTime, tasksCount, null)
    const endTimes = ensureArrayLength(teamState.endTime, tasksCount, null)
    const activeStart = toDateValue(startTimes[taskIndex])
    const activeEnd = toDateValue(endTimes[taskIndex])
    const activeFailure = getTaskFailureForIndex(teamState, taskIndex)

    if (!hasNextTask) {
      if (activeEnd) {
        return updateTeam(teamState, { activeNum: nextIndex })
      }

      if (activeStart && taskDuration > 0) {
        const elapsed = getEffectiveElapsedSeconds(
          teamState,
          taskIndex,
          activeStart,
        )
        if (elapsed >= taskDuration) {
          const failedAt = getTimeoutFailedAt(teamState, taskIndex, activeStart)
          return updateTeam(teamState, {
            ...buildTimeoutFailureUpdates(teamState, taskIndex, failedAt),
            activeNum: nextIndex,
          })
        }
      }

      return teamState
    }

    if (activeFailure?.failedAt) {
      const failedAt = toDateValue(activeFailure.failedAt)
      if (!failedAt) return teamState
      if (breakDuration <= 0) {
        return advanceToNextTask(teamState, nextIndex, failedAt)
      }

      const elapsedAfterFailure = Math.max(
        Math.floor((nowMs - failedAt.getTime()) / 1000),
        0,
      )
      if (elapsedAfterFailure >= breakDuration) {
        return advanceToNextTask(
          teamState,
          nextIndex,
          new Date(failedAt.getTime() + breakDuration * 1000),
        )
      }

      return teamState
    }

    if (activeEnd) {
      if (breakDuration <= 0) {
        return advanceToNextTask(teamState, nextIndex, activeEnd)
      }

      const elapsedAfterEnd = Math.max(
        Math.floor((nowMs - activeEnd.getTime()) / 1000),
        0,
      )
      if (elapsedAfterEnd >= breakDuration) {
        return advanceToNextTask(
          teamState,
          nextIndex,
          new Date(activeEnd.getTime() + breakDuration * 1000),
        )
      }

      return teamState
    }

    if (activeStart && taskDuration > 0) {
      const elapsed = getEffectiveElapsedSeconds(teamState, taskIndex, activeStart)
      if (elapsed >= taskDuration) {
        const failedAt = getTimeoutFailedAt(teamState, taskIndex, activeStart)
        const timeoutUpdates = buildTimeoutFailureUpdates(
          teamState,
          taskIndex,
          failedAt,
        )

        if (breakDuration > 0) {
          if (elapsed >= taskDuration + breakDuration) {
            return advanceToNextTask(
              teamState,
              nextIndex,
              new Date(failedAt.getTime() + breakDuration * 1000),
              timeoutUpdates,
            )
          }

          return updateTeam(teamState, timeoutUpdates)
        }

        return advanceToNextTask(teamState, nextIndex, failedAt, timeoutUpdates)
      }
    }

    return teamState
  }

  let effectiveTeam = gameTeam
  for (let guard = 0; guard < tasksCount + 1; guard += 1) {
    const beforeSignature = JSON.stringify({
      activeNum: Number.isInteger(effectiveTeam?.activeNum)
        ? effectiveTeam.activeNum
        : 0,
      startTime: ensureArrayLength(effectiveTeam?.startTime, tasksCount, null).map(
        (value) => toDateValue(value)?.toISOString() || null,
      ),
      taskFailures: normalizeTaskFailuresForUpdate(
        effectiveTeam?.taskFailures,
      ).map((item) => ({
        taskIndex: item.taskIndex,
        failedAt: item.failedAt.toISOString(),
        source: item.source,
      })),
    })

    const nextTeam = await progressOnce(effectiveTeam)
    effectiveTeam = nextTeam || effectiveTeam

    const afterSignature = JSON.stringify({
      activeNum: Number.isInteger(effectiveTeam?.activeNum)
        ? effectiveTeam.activeNum
        : 0,
      startTime: ensureArrayLength(effectiveTeam?.startTime, tasksCount, null).map(
        (value) => toDateValue(value)?.toISOString() || null,
      ),
      taskFailures: normalizeTaskFailuresForUpdate(
        effectiveTeam?.taskFailures,
      ).map((item) => ({
        taskIndex: item.taskIndex,
        failedAt: item.failedAt.toISOString(),
        source: item.source,
      })),
    })

    if (afterSignature === beforeSignature) {
      break
    }
  }

  return effectiveTeam
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

const resolveCodeDisplay = (value) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Number.isFinite(value)) {
    return String(value).trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const fromCode = normalizeText(value.code)
  if (fromCode) {
    return fromCode
  }

  const fromValue = normalizeText(value.value)
  if (fromValue) {
    return fromValue
  }

  const fromText = normalizeText(value.text)
  if (fromText) {
    return fromText
  }

  return ''
}

const buildCodeDescriptionLookup = (definitions) => {
  const lookup = new Map()
  ;(Array.isArray(definitions) ? definitions : []).forEach((item) => {
    const normalizedCode = normalizeCode(item?.code)
    if (!normalizedCode) {
      return
    }
    lookup.set(normalizedCode, normalizeText(item?.description))
  })
  return lookup
}

const normalizeFoundCodeItems = (values, descriptionLookup) => {
  const unique = new Set()
  const lookup =
    descriptionLookup instanceof Map ? descriptionLookup : new Map()

  return (Array.isArray(values) ? values : [])
    .map((value) => {
      const code = resolveCodeDisplay(value)
      const normalized = normalizeCode(code)
      if (!normalized) {
        return null
      }
      if (unique.has(normalized)) {
        return null
      }
      unique.add(normalized)
      return {
        code,
        description: lookup.get(normalized) || '',
      }
    })
    .filter(Boolean)
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
    const TeamsUsersModel = db.model('TeamsUsers')
    const UsersModel = db.model('Users')

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

    const normalizedGameStatus =
      typeof game.status === 'string' ? game.status.trim().toLowerCase() : ''
    if (
      normalizedGameStatus !== 'started' &&
      normalizedGameStatus !== 'finished' &&
      normalizedGameStatus !== 'closed'
    ) {
      return NextResponse.json(
        { success: false, error: 'Статистика доступна только для начатых или завершённых игр' },
        { status: 400 },
      )
    }

    const taskDuration = game.taskDuration ?? 3600
    const cluesDuration = game.cluesDuration ?? 1200
    const breakDuration = game.breakDuration ?? 0
    const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0

    let gameTeams = await GamesTeamsModel.find({
      gameId: gameId.trim(),
    }).lean()

    if (normalizedGameStatus === 'started') {
      const statusCheckedAt = new Date()
      gameTeams = await Promise.all(
        gameTeams.map((gameTeam) =>
          syncGameTeamProgressForStatus({
            game,
            gameTeam,
            gamesTeamsModel: GamesTeamsModel,
            now: statusCheckedAt,
          }),
        ),
      )
    }
    const teamIds = gameTeams
      .map((gt) => toStringId(gt?.teamId))
      .filter(Boolean)
    const unreadMessagesByTeamId = await fetchUnreadTeamMessageCounts({
      db,
      gameId: gameId.trim(),
    })

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

    const teamMembersByTeamId = new Map()
    if (teamIds.length > 0) {
      const memberships = await TeamsUsersModel.find({ teamId: { $in: teamIds } })
        .select({ _id: 1, teamId: 1, userId: 1, userTelegramId: 1, role: 1 })
        .lean()

      const membershipUserIds = Array.from(
        new Set(
          memberships
            .map((item) => normalizeStringId(item?.userId))
            .filter(Boolean),
        ),
      )
      const membershipTelegramIds = Array.from(
        new Set(
          memberships
            .map((item) => Number(item?.userTelegramId))
            .filter((value) => Number.isFinite(value)),
        ),
      )

      const userFilter = {
        $or: [
          ...(membershipUserIds.length > 0
            ? [{ _id: { $in: membershipUserIds } }]
            : []),
          ...(membershipTelegramIds.length > 0
            ? [{ telegramId: { $in: membershipTelegramIds } }]
            : []),
        ],
      }
      const users =
        userFilter.$or.length > 0
          ? await UsersModel.find(userFilter)
              .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
              .lean()
          : []

      const userById = new Map()
      const userByTelegramId = new Map()
      users.forEach((user) => {
        const userId = normalizeStringId(user?._id)
        if (userId) {
          userById.set(userId, user)
        }
        const telegramId = Number(user?.telegramId)
        if (Number.isFinite(telegramId)) {
          userByTelegramId.set(String(telegramId), user)
        }
      })

      memberships.forEach((membership) => {
        const teamId = normalizeStringId(membership?.teamId)
        if (!teamId) {
          return
        }

        const membershipUserId = normalizeStringId(membership?.userId)
        const membershipTelegramId = Number(membership?.userTelegramId)
        const user =
          (membershipUserId ? userById.get(membershipUserId) : null) ||
          (Number.isFinite(membershipTelegramId)
            ? userByTelegramId.get(String(membershipTelegramId))
            : null) ||
          null

        const member = {
          id: normalizeStringId(user?._id) || membershipUserId || '',
          role: normalizeText(membership?.role) || 'participant',
          name:
            normalizeText(user?.name) ||
            normalizeText(user?.username) ||
            (Number.isFinite(membershipTelegramId)
              ? `Участник ${membershipTelegramId}`
              : 'Участник'),
          username: normalizeText(user?.username),
          phone: normalizeText(user?.phone),
          telegramId: Number.isFinite(Number(user?.telegramId))
            ? String(Number(user.telegramId))
            : Number.isFinite(membershipTelegramId)
              ? String(membershipTelegramId)
              : '',
        }

        const currentMembers = teamMembersByTeamId.get(teamId) || []
        currentMembers.push(member)
        teamMembersByTeamId.set(teamId, currentMembers)
      })
    }

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
      const taskFailures = Array.isArray(gt.taskFailures)
        ? gt.taskFailures.map(normalizeTaskFailureEntry).filter(Boolean)
        : []
      const photos = Array.isArray(gt.photos) ? gt.photos : []
      const timeAddings = Array.isArray(gt.timeAddings) ? gt.timeAddings : []

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
      const currentTaskSource = Array.isArray(game.tasks)
        ? game.tasks[activeTaskIndex]
        : null
      const activeTaskFailure = taskFailures.find(
        (item) => item.taskIndex === activeTaskIndex,
      )
      const bonusCodeDescriptionLookup = buildCodeDescriptionLookup(
        currentTaskSource?.bonusCodes,
      )
      const penaltyCodeDescriptionLookup = buildCodeDescriptionLookup(
        currentTaskSource?.penaltyCodes,
      )
      const currentBonusCodeItems = normalizeFoundCodeItems(
        currentBonusCodes,
        bonusCodeDescriptionLookup,
      )
      const currentPenaltyCodeItems = normalizeFoundCodeItems(
        currentPenaltyCodes,
        penaltyCodeDescriptionLookup,
      )
      const currentClueAdvanceSeconds = getClueAdvanceSecondsForTask({
        timeAddings,
        taskIndex: activeTaskIndex,
        task: currentTaskSource,
      })
      const currentForcedCluesCount = getForcedClueAddingsCountForTask({
        timeAddings,
        taskIndex: activeTaskIndex,
        task: currentTaskSource,
      })
      const getEffectiveTaskSeconds = (taskIndex, baseSeconds) => {
        const taskSource = Array.isArray(game.tasks)
          ? game.tasks[taskIndex]
          : null
        return (
          Math.max(0, Number(baseSeconds) || 0) +
          getTaskElapsedAdjustmentSeconds({
            timeAddings,
            taskIndex,
            task: taskSource,
          })
        )
      }

      const isActiveTaskFinished =
        activeTaskIndex >= tasksCount ||
        Boolean(endTime[activeTaskIndex]) ||
        Boolean(activeTaskFailure) ||
        (startTime[activeTaskIndex]
          ? getEffectiveTaskSeconds(
              activeTaskIndex,
              getSecondsBetween(startTime[activeTaskIndex], now),
            ) > taskDuration
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
      const isActiveTaskFailedByCaptain =
        isActiveTaskFailed && activeTaskFailure?.source === 'captain'

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
            sumTimeSeconds += getEffectiveTaskSeconds(
              i,
              getSecondsBetween(startTime[i], now),
            )
          }
        } else if (endTime[i]) {
          sumTimeSeconds += getSecondsBetween(startTime[i], endTime[i])
        } else {
          sumTimeSeconds += taskDuration
        }
      }

      // Время на текущем задании
      let currentTaskActualSeconds = 0
      let currentTaskSeconds = 0
      if (startTime[activeTaskIndex] && !isActiveTaskFinished) {
        currentTaskActualSeconds = Math.max(
          0,
          getSecondsBetween(startTime[activeTaskIndex], now),
        )
        currentTaskSeconds = getEffectiveTaskSeconds(
          activeTaskIndex,
          currentTaskActualSeconds,
        )
      }

      // Перерыв
      let breakTimeLeftSeconds = 0
      if (isTeamOnBreak) {
        const finishTime = endTime[activeTaskIndex]
          ? new Date(endTime[activeTaskIndex])
          : activeTaskFailure?.failedAt
            ? new Date(activeTaskFailure.failedAt)
          : startTime[activeTaskIndex]
            ? new Date(
                new Date(startTime[activeTaskIndex]).getTime() +
                  Math.max(taskDuration - currentClueAdvanceSeconds, 0) * 1000,
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
        const taskFailure = taskFailures.find(
          (item) => item.taskIndex === taskIndex,
        )

        let completedSeconds = null
        const normalizedTaskDuration = Math.max(0, Math.floor(taskDuration || 0))

        if (taskFailure && Number.isFinite(startMs)) {
          completedSeconds = normalizedTaskDuration
        } else if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
          completedSeconds = Math.max(
            0,
            Math.floor((endMs - startMs) / 1000) +
              getTaskElapsedAdjustmentSeconds({
                timeAddings,
                taskIndex,
                task: taskSource,
              }),
          )
          if (normalizedTaskDuration > 0) {
            completedSeconds = Math.min(completedSeconds, normalizedTaskDuration)
          }
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
              ? Math.min(
                  Math.max(
                    0,
                    diffByNextStart +
                      getTaskElapsedAdjustmentSeconds({
                        timeAddings,
                        taskIndex,
                        task: taskSource,
                      }),
                  ),
                  normalizedTaskDuration,
                )
              : Math.max(
                  0,
                  diffByNextStart +
                    getTaskElapsedAdjustmentSeconds({
                      timeAddings,
                      taskIndex,
                      task: taskSource,
                    }),
                )
        } else if (Number.isFinite(startMs) && taskIndex < activeTaskIndexInt) {
          completedSeconds = normalizedTaskDuration
        } else if (Number.isFinite(startMs) && taskIndex === activeTaskIndexInt) {
          const elapsedForActiveTask = Math.max(
            0,
            Math.floor((Date.now() - startMs) / 1000),
          )
          completedSeconds =
            normalizedTaskDuration > 0
              ? Math.min(
                  Math.max(
                    0,
                    elapsedForActiveTask +
                      getTaskElapsedAdjustmentSeconds({
                        timeAddings,
                        taskIndex,
                        task: taskSource,
                      }),
                  ),
                  normalizedTaskDuration,
                )
              : Math.max(
                  0,
                  elapsedForActiveTask +
                    getTaskElapsedAdjustmentSeconds({
                      timeAddings,
                      taskIndex,
                      task: taskSource,
                    }),
                )
        }
        const isFailedTask =
          Number.isFinite(startMs) &&
          !Number.isFinite(endMs) &&
          (Boolean(taskFailure) ||
            taskIndex < activeTaskIndexInt ||
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
          failedByCaptain: taskFailure?.source === 'captain',
          failedByTimeout: taskFailure?.source === 'timeout',
          failedAt: taskFailure?.failedAt || null,
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
            .filter(
              (item) =>
                normalizeTimeAddingScope(item) === 'total_adjustment' &&
                shouldShowTimeAddingInAdjustments(item),
            )
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
        unreadTeamMessagesCount: Number(unreadMessagesByTeamId[teamId] || 0),
        members: teamMembersByTeamId.get(teamId) || [],
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
        bonusCodeItems: currentBonusCodeItems,
        penaltyCodesCount: currentPenaltyCodes.length,
        penaltyCodes: currentPenaltyCodes,
        penaltyCodeItems: currentPenaltyCodeItems,
        isTeamFinished,
        isTeamOnBreak,
        isActiveTaskFinished,
        isActiveTaskFailed,
        isActiveTaskFailedByCaptain,
        sumTimeSeconds,
        currentTaskActualSeconds,
        currentTaskSeconds,
        breakTimeLeftSeconds,
        completedTaskSeconds,
        isBreakFinishedWaitingForNextTask,
        cluesReceived,
        forcedCluesReceived: currentForcedCluesCount,
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

    // Сортировка в статусе игры:
    // 1) По номеру текущего задания (более позднее выше)
    // 2) Для одинакового задания:
    //    - завершившие игру выше незавершивших, между собой по общему времени (меньше выше)
    //    - команды на перерыве выше команд в активной фазе
    //    - на перерыве: кто дольше на перерыве (меньше осталось) — выше
    //    - в активной фазе: кто дольше на задании — выше
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
        if (a.breakTimeLeftSeconds !== b.breakTimeLeftSeconds) {
          // Меньше осталось -> дольше уже на перерыве -> выше в списке
          return a.breakTimeLeftSeconds - b.breakTimeLeftSeconds
        }
      } else if (a.currentTaskSeconds !== b.currentTaskSeconds) {
        // Больше времени на текущем задании -> выше в списке
        return b.currentTaskSeconds - a.currentTaskSeconds
      }
      if (b.findedCodesCount !== a.findedCodesCount) {
        return b.findedCodesCount - a.findedCodesCount
      }
      return 0
    })

    await Promise.all(
      gameTeams.map((gameTeam) => {
        const teamId = toStringId(gameTeam?.teamId)
        return notifyAgentsForGameTeamProgress({
          db,
          game,
          gameTeam,
          team: teamsById[teamId] || null,
        })
      }),
    )

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
