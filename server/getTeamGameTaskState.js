import fetchGame from '@server/fetchGame'
import fetchTeam from '@server/fetchTeam'
import webGameProcess from '@server/webGameProcess'
import dbConnect from '@utils/dbConnect'
import taskText from 'telegram/func/taskText'

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

const formatSecondsForCountdown = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) return '00:00:00'

  const safeSeconds = Math.max(Math.floor(totalSeconds), 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const pad = (num) => String(num).padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const createCountdownSpan = (secondsLeft, targetTimestamp) => {
  const attributes = ['data-task-countdown="break"', 'data-refresh-on-complete="true"']
  if (Number.isFinite(targetTimestamp)) {
    attributes.push(`data-target="${targetTimestamp}"`)
  }
  if (Number.isFinite(secondsLeft)) {
    attributes.push(`data-seconds="${secondsLeft}"`)
  }

  return `<span ${attributes.join(' ')}>${formatSecondsForCountdown(secondsLeft)}</span>`
}

export const GAME_TASK_ERRORS = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  TEAM_ACCESS_DENIED: 'TEAM_ACCESS_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
}

const buildError = (code, extra = {}) => ({ success: false, errorCode: code, ...extra })

const safeSerialize = (value) => JSON.parse(JSON.stringify(value))

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

    const startTimes = ensureArrayWithLength(teamState.startTime, tasksCount, null)
    const endTimes = ensureArrayWithLength(teamState.endTime, tasksCount, null)

    const activeStart = ensureDateValue(startTimes[clampedIndex])
    const activeEnd = ensureDateValue(endTimes[clampedIndex])
    const nowMs = Date.now()

    const updateActiveNum = async (nextActiveNum, extraUpdates = {}) => {
      const updates = { activeNum: nextActiveNum, ...extraUpdates }
      const updatedTeam = await gamesTeamsModel
        .findByIdAndUpdate(teamState._id, updates, { new: true })
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
          0
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
        null
      ).map(cloneDateValue)
      startTimeUpdates[nextIndex] = new Date()

      const forcedCluesUpdates = ensureArrayWithLength(
        teamState.forcedClues,
        tasksCount,
        0
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
        0
      )

      if (elapsedAfterEnd >= breakDurationSeconds) {
        return advanceToNextTask()
      }

      return teamState
    }

    if (activeStart && taskDurationSeconds > 0) {
      const elapsedSinceStart = Math.max(
        Math.floor((nowMs - activeStart.getTime()) / 1000),
        0
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
      Boolean
    )

    processResult = {
      ...(processResult || {}),
      message: processResult?.message || combinedMessages[0] || '',
      messages: combinedMessages,
    }
  }

  let taskHtml = ''
  let taskState = 'idle'
  let postCompletionMessage = null

  const hasCompletedAllTasks = tasksCount > 0 && activeNumRaw >= tasksCount

  if (isGameStarted && !isGameFinished && tasksCount > 0) {
    if (hasCompletedAllTasks) {
      const lastTask = tasks[tasksCount - 1] ?? null
      const finishingPlace = game.finishingPlace
      const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
      if (finishingPlace) {
        completionParts.push(`<br /><br /><b>Точка сбора:</b> ${finishingPlace}`)
      }
      if (lastTask?.postMessage) {
        completionParts.push(
          `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${lastTask.postMessage}</blockquote>`
        )
      }
      taskHtml = completionParts.join('')
      taskState = 'completed'
    } else {
      const startTimes = ensureArrayWithLength(
        effectiveGameTeam.startTime,
        tasksCount,
        null
      )
      const forcedClues = ensureArrayWithLength(
        effectiveGameTeam.forcedClues,
        tasksCount,
        0
      )
      const endTimes = ensureArrayWithLength(
        effectiveGameTeam.endTime,
        tasksCount,
        null
      )

      const activeTaskIndex = Math.max(
        Math.min(activeNumRaw, tasksCount - 1),
        0
      )
      const activeTaskEndTime = ensureDateValue(endTimes[activeTaskIndex])
      const activeTaskStartTime = ensureDateValue(startTimes[activeTaskIndex])

      let breakSecondsLeft = null
      let breakTargetTimestamp = null
      let breakReason = null

      if (breakDurationSeconds > 0) {
        const nowMs = Date.now()

        if (activeTaskEndTime) {
          const elapsed = Math.max(
            Math.floor((nowMs - activeTaskEndTime.getTime()) / 1000),
            0
          )
          if (elapsed < breakDurationSeconds) {
            breakSecondsLeft = breakDurationSeconds - elapsed
            breakTargetTimestamp =
              activeTaskEndTime.getTime() + breakDurationSeconds * 1000
            breakReason = 'success'
          }
        } else if (activeTaskStartTime && taskDurationSeconds > 0) {
          const elapsedSinceStart = Math.max(
            Math.floor((nowMs - activeTaskStartTime.getTime()) / 1000),
            0
          )
          if (elapsedSinceStart >= taskDurationSeconds) {
            const overtime = elapsedSinceStart - taskDurationSeconds
            if (overtime < breakDurationSeconds) {
              breakSecondsLeft = breakDurationSeconds - overtime
              breakTargetTimestamp =
                activeTaskStartTime.getTime() +
                (taskDurationSeconds + breakDurationSeconds) * 1000
              breakReason = 'timeout'
            }
          }
        }
      }

      if (breakSecondsLeft !== null) {
        const postMessage = tasks[activeTaskIndex]?.postMessage
        if (postMessage) {
          postCompletionMessage = postMessage
        }
        const breakParts = [
          breakReason === 'timeout'
            ? '<b>Время на задание вышло.</b>'
            : '<b>Задание выполнено.</b>',
        ]
        breakParts.push('<br /><br /><b>Перерыв.</b>')
        breakParts.push('<br /><br /><b>Ожидайте следующее задание после перерыва.</b>')
        breakParts.push(
          `<br /><br /><b>Время до окончания перерыва:</b> ${createCountdownSpan(
            breakSecondsLeft,
            breakTargetTimestamp
          )}`
        )
        taskHtml = breakParts.join('')
        taskState = 'break'
      } else {
        let elapsedSeconds = 0
        if (activeTaskStartTime) {
          elapsedSeconds = Math.max(
            Math.floor((Date.now() - activeTaskStartTime.getTime()) / 1000),
            0
          )
        }

        const forcedCluesCount = Math.max(
          forcedClues[activeTaskIndex] ?? 0,
          0
        )
        const timedCluesCount =
          cluesDurationSeconds > 0
            ? Math.max(Math.floor(elapsedSeconds / cluesDurationSeconds), 0)
            : 0
        const visibleCluesCount = Math.max(timedCluesCount, forcedCluesCount)

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

        taskState = 'active'

        if (activeTaskIndex > 0) {
          const previousTask = tasks[activeTaskIndex - 1] ?? null
          if (previousTask?.postMessage) {
            postCompletionMessage = previousTask.postMessage
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
      postCompletionMessage = lastTask.postMessage
    }
    taskHtml = completionParts.join('')
    taskState = 'completed'
  }

  return {
    taskHtml,
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
    const isGameFinished = status === 'finished'

    const db = await dbConnect(location)

    if (!db) {
      return buildError(GAME_TASK_ERRORS.DB_CONNECTION_FAILED, {
        game: safeSerialize(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
      })
    }

    const gamesTeamsModel = db.model('GamesTeams')
    const teamsUsersModel = db.model('TeamsUsers')

    let gameTeam = await gamesTeamsModel
      .findOne({ gameId, teamId })
      .lean()

    if (!gameTeam) {
      return buildError(GAME_TASK_ERRORS.TEAM_NOT_FOUND, { statusCode: 404 })
    }

    if (telegramId) {
      const telegramIdStr = String(telegramId)
      const teamUsers = await teamsUsersModel
        .find({ teamId })
        .lean()
      const currentTeamUser = teamUsers.find(
        (teamUser) =>
          teamUser && String(teamUser.userTelegramId ?? '') === telegramIdStr
      )

      if (!currentTeamUser) {
        return buildError(GAME_TASK_ERRORS.TEAM_ACCESS_DENIED, {
          statusCode: 403,
          game: safeSerialize(game),
          team: safeSerialize(team),
          status,
          isGameStarted,
          isGameFinished,
        })
      }
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
      taskState,
      processResult: finalResult,
      postCompletionMessage,
    } =
      await computeTaskHtml({
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
        game: safeSerialize(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
        result: finalResult ? safeSerialize(finalResult) : null,
        taskHtml,
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
