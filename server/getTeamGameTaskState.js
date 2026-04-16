import fetchGame from '@server/fetchGame'
import fetchTeam from '@server/fetchTeam'
import webGameProcess from '@server/webGameProcess'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import taskText from 'telegram/func/taskText'
import sanitize from '@helpers/sanitize'
import buildTaskDisplayContent from '@helpers/buildTaskDisplayContent'

const ensureDateValue = (value) => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const cloneDateValue = (value) => {
  const date = ensureDateValue(value)
  return date ? new Date(date.getTime()) : null
}

const ensureArrayWithLength = (value, length, filler) => {
  const base = Array.isArray(value) ? [...value] : []
  if (base.length < length) {
    return base.concat(new Array(length - base.length).fill(filler))
  }
  return base.slice(0, length)
}

const parseDurationSeconds = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(Math.floor(numeric), 0)
}

const toFiniteNonNegativeIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const normalized = Math.floor(numeric)
  return normalized >= 0 ? normalized : null
}

const normalizeAcceptedCodes = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (typeof item === 'number' && Number.isFinite(item)) {
        return String(item).trim()
      }
      if (item && typeof item === 'object') {
        const codeValue = item.code
        if (typeof codeValue === 'string') {
          return codeValue.trim()
        }
        if (typeof codeValue === 'number' && Number.isFinite(codeValue)) {
          return String(codeValue).trim()
        }
      }
      return ''
    })
    .filter(Boolean)
}

const buildAcceptedCodeItems = (codeDefinitions, acceptedCodes) => {
  const safeDefinitions = Array.isArray(codeDefinitions) ? codeDefinitions : []
  const safeAccepted = Array.isArray(acceptedCodes) ? acceptedCodes : []
  const acceptedSet = new Set(safeAccepted.map((value) => value.toLowerCase()))

  const indexedByCode = new Map()
  safeDefinitions.forEach((item) => {
    const codeValue = typeof item?.code === 'string' ? item.code.trim() : ''
    if (!codeValue) return
    indexedByCode.set(codeValue.toLowerCase(), {
      code: codeValue,
      description:
        typeof item?.description === 'string' ? item.description.trim() : '',
    })
  })

  return safeAccepted.map((acceptedCode) => {
    const byDefinition = indexedByCode.get(acceptedCode.toLowerCase())
    return {
      code: byDefinition?.code || acceptedCode,
      description: byDefinition?.description || '',
      isKnown: acceptedSet.has(acceptedCode.toLowerCase()),
    }
  })
}

const buildTaskDisplayMeta = (task, gameTeam, taskIndex) => {
  const mainCodesCount = Array.isArray(task?.codes) ? task.codes.length : 0
  const safeTaskIndex = Number.isFinite(Number(taskIndex))
    ? Math.max(Math.floor(Number(taskIndex)), 0)
    : 0
  const acceptedMainCodes = normalizeAcceptedCodes(
    Array.isArray(gameTeam?.findedCodes)
      ? gameTeam.findedCodes[safeTaskIndex]
      : [],
  )
  const acceptedBonusCodes = normalizeAcceptedCodes(
    Array.isArray(gameTeam?.findedBonusCodes)
      ? gameTeam.findedBonusCodes[safeTaskIndex]
      : [],
  )
  const acceptedPenaltyCodes = normalizeAcceptedCodes(
    Array.isArray(gameTeam?.findedPenaltyCodes)
      ? gameTeam.findedPenaltyCodes[safeTaskIndex]
      : [],
  )
  const acceptedBonusCodeItems = buildAcceptedCodeItems(
    Array.isArray(task?.bonusCodes) ? task.bonusCodes : [],
    acceptedBonusCodes,
  )
  const acceptedPenaltyCodeItems = buildAcceptedCodeItems(
    Array.isArray(task?.penaltyCodes) ? task.penaltyCodes : [],
    acceptedPenaltyCodes,
  )

  return {
    mainCodesCount,
    requiredCodesCount: toFiniteNonNegativeIntegerOrNull(
      task?.numCodesToCompliteTask,
    ),
    bonusCodesCount: Array.isArray(task?.bonusCodes) ? task.bonusCodes.length : 0,
    penaltyCodesCount: Array.isArray(task?.penaltyCodes)
      ? task.penaltyCodes.length
      : 0,
    acceptedMainCodes,
    acceptedBonusCodes,
    acceptedPenaltyCodes,
    acceptedBonusCodeItems,
    acceptedPenaltyCodeItems,
  }
}

export const GAME_TASK_ERRORS = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  TEAM_ACCESS_DENIED: 'TEAM_ACCESS_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
}

const buildError = (code, extra = {}) => ({
  success: false,
  errorCode: code,
  ...extra,
})

const safeSerialize = (value) => JSON.parse(JSON.stringify(value))
const sanitizeFragment = (value) => sanitize(String(value || ''))

// Безопасная проекция game для клиента — БЕЗ ответов/кодов/подсказок
const safeSerializeGameForClient = (game) => {
  if (!game) return null
  return {
    _id: game._id ? String(game._id) : undefined,
    name: game.name || '',
    type: game.type || 'classic',
    location: game.location || '',
    dateStart: game.dateStart || null,
    dateStartFact: game.dateStartFact || null,
    dateEndFact: game.dateEndFact || null,
    status: game.status || 'active',
    finishingPlace: game.finishingPlace || '',
    image: game.image || null,
    tasksCount: Array.isArray(game.tasks) ? game.tasks.length : 0,
  }
}

const computeTaskHtml = async ({
  game,
  gameTeam,
  processResult,
  isGameStarted,
  isGameFinished,
  gamesTeamsModel,
}) => {
  const tasks = Array.isArray(game.tasks) ? game.tasks : []
  const tasksCount = tasks.length

  const breakDurationSeconds = parseDurationSeconds(game.breakDuration, 0)
  const taskDurationSeconds = parseDurationSeconds(game.taskDuration, 3600)
  const cluesDurationSeconds = parseDurationSeconds(game.cluesDuration, 1200)

  const autoProgressMessages = []

  const maybeHandleAutomaticProgress = async (teamState) => {
    if (!teamState || tasksCount === 0) return teamState

    const activeNumValue = Number.isInteger(teamState?.activeNum)
      ? teamState.activeNum
      : 0
    const clampedIndex = Math.max(Math.min(activeNumValue, tasksCount - 1), 0)

    if (activeNumValue >= tasksCount) {
      return teamState
    }

    const nextIndex = clampedIndex + 1
    const hasNextTask = nextIndex < tasksCount

    const startTimes = ensureArrayWithLength(
      teamState.startTime,
      tasksCount,
      null,
    )
    const endTimes = ensureArrayWithLength(teamState.endTime, tasksCount, null)

    const activeStart = ensureDateValue(startTimes[clampedIndex])
    const activeEnd = ensureDateValue(endTimes[clampedIndex])
    const nowMs = Date.now()

    const updateActiveNum = async (nextActiveNum, extraUpdates = {}) => {
      const updates = { activeNum: nextActiveNum, ...extraUpdates }
      const updatedTeam = await gamesTeamsModel
        .findByIdAndUpdate(teamState._id, updates, { returnDocument: 'after' })
        .lean()

      return updatedTeam ?? { ...teamState, ...updates }
    }

    if (!hasNextTask) {
      if (activeEnd) {
        return updateActiveNum(nextIndex)
      }

      if (activeStart && taskDurationSeconds > 0) {
        const elapsedSinceStart = Math.max(
          Math.floor((nowMs - activeStart.getTime()) / 1000),
          0,
        )

        if (elapsedSinceStart >= taskDurationSeconds) {
          return updateActiveNum(nextIndex)
        }
      }

      return teamState
    }

    const advanceToNextTask = async () => {
      const startTimeUpdates = ensureArrayWithLength(
        teamState.startTime,
        tasksCount,
        null,
      ).map(cloneDateValue)
      startTimeUpdates[nextIndex] = new Date()

      const forcedCluesUpdates = ensureArrayWithLength(
        teamState.forcedClues,
        tasksCount,
        0,
      ).map((value) => (Number.isFinite(value) ? value : 0))
      forcedCluesUpdates[nextIndex] = 0

      return updateActiveNum(nextIndex, {
        startTime: startTimeUpdates,
        forcedClues: forcedCluesUpdates,
      })
    }

    if (activeEnd) {
      if (breakDurationSeconds <= 0) {
        return advanceToNextTask()
      }

      const elapsedAfterEnd = Math.max(
        Math.floor((nowMs - activeEnd.getTime()) / 1000),
        0,
      )

      if (elapsedAfterEnd >= breakDurationSeconds) {
        return advanceToNextTask()
      }

      return teamState
    }

    if (activeStart && taskDurationSeconds > 0) {
      const elapsedSinceStart = Math.max(
        Math.floor((nowMs - activeStart.getTime()) / 1000),
        0,
      )

      if (elapsedSinceStart >= taskDurationSeconds) {
        if (breakDurationSeconds > 0) {
          if (elapsedSinceStart >= taskDurationSeconds + breakDurationSeconds) {
            autoProgressMessages.push('<b>Перерыв завершён.</b>')
            return advanceToNextTask()
          }
        } else {
          autoProgressMessages.push('<b>Время на задание вышло.</b>')
          return advanceToNextTask()
        }
      }
    }

    return teamState
  }

  let effectiveGameTeam = gameTeam

  effectiveGameTeam = await maybeHandleAutomaticProgress(effectiveGameTeam)

  const activeNumRaw = Number.isInteger(effectiveGameTeam?.activeNum)
    ? effectiveGameTeam.activeNum
    : 0

  if (autoProgressMessages.length > 0) {
    const baseMessages = Array.isArray(processResult?.messages)
      ? [...processResult.messages]
      : []

    if (!processResult?.messages && processResult?.message) {
      baseMessages.push(processResult.message)
    }

    const combinedMessages = [...baseMessages, ...autoProgressMessages].filter(
      Boolean,
    )

    processResult = {
      ...(processResult || {}),
      message: processResult?.message || combinedMessages[0] || '',
      messages: combinedMessages,
    }
  }

  let taskHtml = ''
  let taskDisplayHtml = ''
  let taskDisplayText = ''
  let taskDisplayTaskHtml = ''
  let taskDisplayTaskText = ''
  let taskDisplayClues = []
  let taskDisplayMeta = null
  let taskState = 'idle'
  let postCompletionMessage = null

  const hasCompletedAllTasks = tasksCount > 0 && activeNumRaw >= tasksCount

  if (isGameStarted && !isGameFinished && tasksCount > 0) {
    if (hasCompletedAllTasks) {
      const lastTask = tasks[tasksCount - 1] ?? null
      const finishingPlace = game.finishingPlace
      const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
      if (finishingPlace) {
        completionParts.push(
          `<br /><br /><b>Точка сбора:</b> ${finishingPlace}`,
        )
      }
      if (lastTask?.postMessage) {
        postCompletionMessage = sanitizeFragment(lastTask.postMessage)
      }
      taskHtml = completionParts.join('')
      taskState = 'completed'
    } else {
      const startTimes = ensureArrayWithLength(
        effectiveGameTeam.startTime,
        tasksCount,
        null,
      )
      const forcedClues = ensureArrayWithLength(
        effectiveGameTeam.forcedClues,
        tasksCount,
        0,
      )
      const endTimes = ensureArrayWithLength(
        effectiveGameTeam.endTime,
        tasksCount,
        null,
      )

      const activeTaskIndex = Math.max(
        Math.min(activeNumRaw, tasksCount - 1),
        0,
      )
      const activeTaskEndTime = ensureDateValue(endTimes[activeTaskIndex])
      const activeTaskStartTime = ensureDateValue(startTimes[activeTaskIndex])

      let breakSecondsLeft = null
      let breakReason = null

      if (breakDurationSeconds > 0) {
        const nowMs = Date.now()

        if (activeTaskEndTime) {
          const elapsed = Math.max(
            Math.floor((nowMs - activeTaskEndTime.getTime()) / 1000),
            0,
          )
          if (elapsed < breakDurationSeconds) {
            breakSecondsLeft = breakDurationSeconds - elapsed
            breakReason = 'success'
          }
        } else if (activeTaskStartTime && taskDurationSeconds > 0) {
          const elapsedSinceStart = Math.max(
            Math.floor((nowMs - activeTaskStartTime.getTime()) / 1000),
            0,
          )
          if (elapsedSinceStart >= taskDurationSeconds) {
            const overtime = elapsedSinceStart - taskDurationSeconds
            if (overtime < breakDurationSeconds) {
              breakSecondsLeft = breakDurationSeconds - overtime
              breakReason = 'timeout'
            }
          }
        }
      }

      if (breakSecondsLeft !== null) {
        const postMessage = tasks[activeTaskIndex]?.postMessage
        if (postMessage) {
          postCompletionMessage = sanitizeFragment(postMessage)
        }
        const breakTargetTimestamp = Date.now() + breakSecondsLeft * 1000
        const hiddenBreakCountdown = `<span style="display:none" aria-hidden="true"><span data-task-countdown="break" data-refresh-on-complete="true" data-target="${breakTargetTimestamp}" data-seconds="${Math.max(Math.floor(breakSecondsLeft), 0)}"></span></span>`
        const breakParts = [
          breakReason === 'timeout'
            ? '<b>Время на задание вышло.</b>'
            : '<b>Задание выполнено.</b>',
        ]
        breakParts.push('<br /><br /><b>Перерыв.</b>')
        breakParts.push(
          '<br /><br /><b>Ожидайте следующее задание после перерыва.</b>',
        )
        breakParts.push(hiddenBreakCountdown)
        taskHtml = breakParts.join('')
        const breakTask = tasks[activeTaskIndex] ?? null
        taskDisplayMeta = buildTaskDisplayMeta(
          breakTask,
          effectiveGameTeam,
          activeTaskIndex,
        )
        taskState = 'break'
      } else {
        let elapsedSeconds = 0
        if (activeTaskStartTime) {
          elapsedSeconds = Math.max(
            Math.floor((Date.now() - activeTaskStartTime.getTime()) / 1000),
            0,
          )
        }

        const forcedCluesCount = Math.max(forcedClues[activeTaskIndex] ?? 0, 0)
        const timedCluesCount =
          cluesDurationSeconds > 0
            ? Math.max(Math.floor(elapsedSeconds / cluesDurationSeconds), 0)
            : 0
        const visibleCluesCount = Math.max(timedCluesCount, forcedCluesCount)
        const activeTask = tasks[activeTaskIndex] ?? null

        taskHtml = taskText({
          game,
          taskNum: activeTaskIndex,
          findedCodes: effectiveGameTeam.findedCodes,
          findedBonusCodes: effectiveGameTeam.findedBonusCodes,
          findedPenaltyCodes: effectiveGameTeam.findedPenaltyCodes,
          startTaskTime: activeTaskStartTime,
          cluesDuration: cluesDurationSeconds,
          taskDuration: taskDurationSeconds,
          photos: effectiveGameTeam.photos,
          timeAddings: effectiveGameTeam.timeAddings,
          visibleCluesCount,
          includeActionPrompt: false,
          format: 'web',
        })
        const displayContent = buildTaskDisplayContent({
          task: activeTask,
          visibleCluesCount,
        })
        taskDisplayHtml = displayContent.html
        taskDisplayText = displayContent.text
        taskDisplayTaskHtml = displayContent.taskHtml || ''
        taskDisplayTaskText = displayContent.taskText || ''
        taskDisplayClues = Array.isArray(displayContent.clues)
          ? displayContent.clues
          : []
        taskDisplayMeta = buildTaskDisplayMeta(
          activeTask,
          effectiveGameTeam,
          activeTaskIndex,
        )

        taskState = 'active'

        if (activeTaskIndex > 0) {
          const previousTask = tasks[activeTaskIndex - 1] ?? null
          if (previousTask?.postMessage) {
            postCompletionMessage = sanitizeFragment(previousTask.postMessage)
          }
        }
      }
    }
  }

  if (!taskHtml && (hasCompletedAllTasks || isGameFinished) && tasksCount > 0) {
    const lastTask = tasks[tasksCount - 1] ?? null
    const finishingPlace = game.finishingPlace
    const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
    if (finishingPlace) {
      completionParts.push(`<br /><br /><b>Точка сбора:</b> ${finishingPlace}`)
    }
    if (lastTask?.postMessage) {
      postCompletionMessage = sanitizeFragment(lastTask.postMessage)
    }
    taskHtml = completionParts.join('')
    taskState = 'completed'
  }

  return {
    taskHtml,
    taskDisplayHtml,
    taskDisplayText,
    taskDisplayTaskHtml,
    taskDisplayTaskText,
    taskDisplayClues,
    taskDisplayMeta,
    taskState,
    processResult,
    effectiveGameTeam,
    postCompletionMessage,
  }
}

const getTeamGameTaskState = async ({
  location,
  gameId,
  teamId,
  telegramId,
  userId,
  message,
}) => {
  if (!location || !gameId || !teamId) {
    return buildError(GAME_TASK_ERRORS.INVALID_PARAMS)
  }

  try {
    const [game, team] = await Promise.all([
      fetchGame(location, gameId),
      fetchTeam(location, teamId),
    ])

    if (!game || !game._id) {
      return buildError(GAME_TASK_ERRORS.GAME_NOT_FOUND, { statusCode: 404 })
    }

    if (!team || !team._id) {
      return buildError(GAME_TASK_ERRORS.TEAM_NOT_FOUND, { statusCode: 404 })
    }

    const status = game.status || 'active'
    const isGameStarted = status === 'started'
    const isGameFinished = status === 'finished' || status === 'closed'

    const db = await dbConnectGlobal()

    if (!db) {
      return buildError(GAME_TASK_ERRORS.DB_CONNECTION_FAILED, {
        game: safeSerializeGameForClient(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
      })
    }

    const gamesTeamsModel = db.model('GamesTeams')
    const teamsUsersModel = db.model('TeamsUsers')

    let gameTeam = await gamesTeamsModel.findOne({ gameId, teamId }).lean()

    if (!gameTeam) {
      return buildError(GAME_TASK_ERRORS.TEAM_NOT_FOUND, { statusCode: 404 })
    }

    // Проверка принадлежности пользователя к команде
    const teamUsers = await teamsUsersModel.find({ teamId }).lean()

    let isTeamMember = false

    if (telegramId) {
      const telegramIdStr = String(telegramId)
      isTeamMember = teamUsers.some(
        (teamUser) =>
          teamUser && String(teamUser.userTelegramId ?? '') === telegramIdStr,
      )
    }

    if (!isTeamMember && userId) {
      const userIdStr = String(userId)
      isTeamMember = teamUsers.some(
        (teamUser) => teamUser && String(teamUser.userId ?? '') === userIdStr,
      )
    }

    if (!isTeamMember) {
      return buildError(GAME_TASK_ERRORS.TEAM_ACCESS_DENIED, {
        statusCode: 403,
        game: safeSerializeGameForClient(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
      })
    }

    const actingTelegramId = telegramId

    let processResult = null

    if (actingTelegramId) {
      try {
        processResult = await webGameProcess({
          db,
          game,
          gameTeam,
          gameTeamId: gameTeam._id,
          message,
        })
        if (processResult) {
          const updatedGameTeam = await gamesTeamsModel
            .findById(gameTeam._id)
            .lean()
          if (updatedGameTeam) {
            gameTeam = updatedGameTeam
          }
        }
      } catch (processError) {
        console.error('Game process execution error', processError)
        processResult = {
          message: 'Не удалось получить текущее состояние задания.',
        }
      }
    }

    const {
      taskHtml,
      taskDisplayHtml,
      taskDisplayText,
      taskDisplayTaskHtml,
      taskDisplayTaskText,
      taskDisplayClues,
      taskDisplayMeta,
      taskState,
      processResult: finalResult,
      postCompletionMessage,
    } = await computeTaskHtml({
      game,
      gameTeam,
      processResult,
      isGameStarted,
      isGameFinished,
      gamesTeamsModel,
    })

    return {
      success: true,
      data: {
        game: safeSerializeGameForClient(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
        result: finalResult ? safeSerialize(finalResult) : null,
        taskHtml,
        taskDisplayHtml:
          typeof taskDisplayHtml === 'string' ? taskDisplayHtml : '',
        taskDisplayText:
          typeof taskDisplayText === 'string' ? taskDisplayText : '',
        taskDisplayTaskHtml:
          typeof taskDisplayTaskHtml === 'string' ? taskDisplayTaskHtml : '',
        taskDisplayTaskText:
          typeof taskDisplayTaskText === 'string' ? taskDisplayTaskText : '',
        taskDisplayClues: Array.isArray(taskDisplayClues)
          ? safeSerialize(taskDisplayClues)
          : [],
        taskDisplayMeta:
          taskDisplayMeta && typeof taskDisplayMeta === 'object'
            ? safeSerialize(taskDisplayMeta)
            : null,
        taskState,
        gameTeamId: String(gameTeam._id),
        postCompletionMessage:
          typeof postCompletionMessage === 'string'
            ? postCompletionMessage
            : null,
      },
    }
  } catch (error) {
    console.error('Failed to load team game task state', error)
    return buildError(GAME_TASK_ERRORS.UNKNOWN_ERROR)
  }
}

export default getTeamGameTaskState
