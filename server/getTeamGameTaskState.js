import fetchGame from '@server/fetchGame'
import fetchTeam from '@server/fetchTeam'
import webGameProcess from '@server/webGameProcess'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import taskText from 'telegram/func/taskText'
import sanitize from '@helpers/sanitize'
import buildTaskDisplayContent from '@helpers/buildTaskDisplayContent'
import getGameProcessFinishingPlace from '@helpers/getGameProcessFinishingPlace'
import { notifyAgentsForGameTeamProgress } from '@server/agentNotifications'
import {
  acquireGameProcessLock,
  didGameProcessStepChange,
  releaseGameProcessLock,
} from '@server/gameProcessLock'
import resolveTeamMembershipForIdentity from '@helpers/resolveTeamMembershipForIdentity'
import { getTaskIndexForStep } from '@helpers/taskDistribution'
import { normalizeClueEarlyAccessFrom } from '@helpers/clueEarlyAccess'
import {
  canMutateClassicGameProgress,
  getClassicTaskMutationBlockReason,
  resolveForceClueCost,
  resolveRequiredMainCodesCount,
} from '@helpers/classicGameRules'

const isGameTaskDebugEnabled =
  process.env.GAME_TASK_DEBUG === '1' || process.env.SESSION_DEBUG === '1'

const gameTaskDebugLog = (stage, payload = null) => {
  if (!isGameTaskDebugEnabled) {
    return
  }

  const time = new Date().toISOString()
  if (payload === null || payload === undefined) {
    console.info(`[game-task-debug] ${time} ${stage}`)
    return
  }

  console.info(`[game-task-debug] ${time} ${stage}`, payload)
}

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
      value: Number(item?.bonus ?? item?.penalty ?? 0),
    })
  })

  return safeAccepted.map((acceptedCode) => {
    const byDefinition = indexedByCode.get(acceptedCode.toLowerCase())
    return {
      code: byDefinition?.code || acceptedCode,
      description: byDefinition?.description || '',
      value: byDefinition?.value || 0,
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
    taskIndex: safeTaskIndex,
    mainCodesCount,
    requiredCodesCount: resolveRequiredMainCodesCount(task),
    bonusCodesCount: Array.isArray(task?.bonusCodes)
      ? task.bonusCodes.length
      : 0,
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
const getTaskPostCompletionMessage = (task) => {
  const rich =
    typeof task?.postMessageRich === 'string' ? task.postMessageRich.trim() : ''
  const plain =
    typeof task?.postMessage === 'string' ? task.postMessage.trim() : ''
  const source = rich || plain
  return source ? sanitizeFragment(source) : ''
}

const normalizeTaskFailures = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const taskIndex = Number(item?.taskIndex)
          const failedAt = ensureDateValue(item?.failedAt)
          if (!Number.isInteger(taskIndex) || taskIndex < 0 || !failedAt) {
            return null
          }
          return {
            taskIndex,
            taskId:
              typeof item?.taskId === 'string' && item.taskId.trim()
                ? item.taskId.trim()
                : '',
            failedAt,
            source:
              typeof item?.source === 'string' && item.source.trim()
                ? item.source.trim()
                : 'captain',
            reason:
              typeof item?.reason === 'string' && item.reason.trim()
                ? item.reason.trim()
                : '',
          }
        })
        .filter(Boolean)
    : []

const getTaskFailureEntry = (gameTeam, taskIndex) =>
  normalizeTaskFailures(gameTeam?.taskFailures).find(
    (item) => item.taskIndex === taskIndex,
  ) || null

const getTaskIdValue = (task) =>
  task?._id !== null && task?._id !== undefined ? String(task._id) : ''

const getClueAdvanceSecondsForTask = ({ gameTeam, taskIndex, task }) => {
  const taskId = getTaskIdValue(task)
  const addings = Array.isArray(gameTeam?.timeAddings)
    ? gameTeam.timeAddings
    : []

  return addings.reduce((sum, adding) => {
    const source = typeof adding?.source === 'string' ? adding.source : ''
    const name = typeof adding?.name === 'string' ? adding.name : ''
    const isCaptainForceClue =
      source === 'captain_force_clue' || name.startsWith('Досрочная подсказка')
    if (!isCaptainForceClue) return sum

    if (taskId && adding?.taskId) {
      if (String(adding.taskId) !== taskId) return sum
    } else if (typeof adding?.taskIndex === 'number') {
      if (adding.taskIndex !== taskIndex) return sum
    } else {
      return sum
    }

    const seconds = Number(adding?.time)
    return Number.isFinite(seconds) && seconds > 0 ? sum + seconds : sum
  }, 0)
}

const getEffectiveTaskElapsedSeconds = ({
  gameTeam,
  taskIndex,
  task,
  startTime,
  now = new Date(),
}) => {
  const startAt = ensureDateValue(startTime)
  if (!startAt) return 0

  const nowDate = ensureDateValue(now) || new Date()
  const realElapsed = Math.max(
    Math.floor((nowDate.getTime() - startAt.getTime()) / 1000),
    0,
  )

  return (
    realElapsed +
    getClueAdvanceSecondsForTask({
      gameTeam,
      taskIndex,
      task,
    })
  )
}

const getVisibleCluesCountForTask = ({
  gameTeam,
  task,
  taskIndex,
  startTime,
  cluesDurationSeconds,
  forcedCluesCount,
}) => {
  const totalClues = Array.isArray(task?.clues) ? task.clues.length : 0
  if (totalClues <= 0) return 0

  const elapsedSeconds = getEffectiveTaskElapsedSeconds({
    gameTeam,
    taskIndex,
    task,
    startTime,
  })
  const timedCluesCount =
    cluesDurationSeconds > 0
      ? Math.max(Math.floor(elapsedSeconds / cluesDurationSeconds), 0)
      : 0

  return Math.min(
    totalClues,
    Math.max(timedCluesCount, Math.max(forcedCluesCount || 0, 0)),
  )
}

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
    finishingPlace: getGameProcessFinishingPlace(game),
    showFinishingPlace: Boolean(game.showFinishingPlace),
    image: game.image || null,
    tasksCount: Array.isArray(game.tasks) ? game.tasks.length : 0,
  }
}

const buildCaptainActions = ({ game, isCaptain }) => ({
  canFinishBreak:
    Boolean(isCaptain) &&
    canMutateClassicGameProgress(game?.status) &&
    game?.allowCaptainFinishBreak !== false &&
    parseDurationSeconds(game?.breakDuration, 0) > 0,
  canForceClue: false,
  forceClueAdvanceSeconds: 0,
  forceClueCostSeconds: 0,
  forceClueMode:
    game?.clueEarlyAccessMode === 'penalty' ? 'penalty' : 'time',
  nextClueNumber: null,
  canFailTask: false,
})

const getActiveTaskStep = (gameTeam) =>
  Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0

const getActiveSourceTaskIndex = (game, gameTeam) =>
  getTaskIndexForStep(game, gameTeam, getActiveTaskStep(gameTeam))

const getNextTaskStep = (gameTeam) => getActiveTaskStep(gameTeam) + 1

const getNextSourceTaskIndex = (game, gameTeam) =>
  getTaskIndexForStep(game, gameTeam, getNextTaskStep(gameTeam))

const buildCaptainActionsForState = ({ game, gameTeam, isCaptain }) => {
  const base = buildCaptainActions({ game, isCaptain })
  if (!isCaptain) {
    return base
  }

  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const tasksCount = tasks.length
  const activeTaskIndex = getActiveSourceTaskIndex(game, gameTeam)
  if (activeTaskIndex === null || activeTaskIndex < 0 || activeTaskIndex >= tasksCount) {
    return base
  }

  const startTimes = ensureArrayWithLength(
    gameTeam?.startTime,
    tasksCount,
    null,
  )
  const endTimes = ensureArrayWithLength(gameTeam?.endTime, tasksCount, null)
  const forcedClues = ensureArrayWithLength(
    gameTeam?.forcedClues,
    tasksCount,
    0,
  )
  const activeTask = tasks[activeTaskIndex]
  const totalClues = Array.isArray(activeTask?.clues)
    ? activeTask.clues.length
    : 0
  const cluesDurationSeconds = parseDurationSeconds(game?.cluesDuration, 1200)
  const visibleCluesCount = getVisibleCluesCountForTask({
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
    startTime: startTimes[activeTaskIndex],
    cluesDurationSeconds,
    forcedCluesCount: forcedClues[activeTaskIndex],
  })
  const isAlreadyFinished = Boolean(endTimes[activeTaskIndex])
  const isAlreadyFailed = Boolean(
    getTaskFailureEntry(gameTeam, activeTaskIndex),
  )
  const mutationBlockReason = getClassicTaskMutationBlockReason({
    game,
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
  })
  const canMutateActiveTask =
    canMutateClassicGameProgress(game?.status) &&
    !isAlreadyFinished &&
    !isAlreadyFailed &&
    !mutationBlockReason
  const effectiveElapsedSeconds = getEffectiveTaskElapsedSeconds({
    gameTeam,
    taskIndex: activeTaskIndex,
    task: activeTask,
    startTime: startTimes[activeTaskIndex],
  })
  const nextClueNumber =
    totalClues > 0 ? Math.min(visibleCluesCount + 1, totalClues) : null
  const clueEarlyAccessFrom = normalizeClueEarlyAccessFrom(
    game?.clueEarlyAccessFrom,
  )
  const secondsUntilNextClue =
    nextClueNumber && cluesDurationSeconds > 0
      ? Math.max(
          nextClueNumber * cluesDurationSeconds - effectiveElapsedSeconds,
          0,
        )
      : 0
  const forceClueCost = resolveForceClueCost({
    mode: game?.clueEarlyAccessMode,
    configuredPenaltySeconds: game?.clueEarlyPenalty,
    secondsUntilNextClue,
  })
  const canForceClue =
    game?.allowCaptainForceClue !== false &&
    totalClues > 0 &&
    cluesDurationSeconds > 0 &&
    visibleCluesCount < totalClues &&
    nextClueNumber >= clueEarlyAccessFrom &&
    secondsUntilNextClue > 0 &&
    canMutateActiveTask

  return {
    ...base,
    canForceClue,
    forceClueAdvanceSeconds: canForceClue ? forceClueCost.seconds : 0,
    forceClueCostSeconds: canForceClue ? forceClueCost.seconds : 0,
    forceClueMode: forceClueCost.mode,
    nextClueNumber: canForceClue ? nextClueNumber : null,
    canFailTask:
      game?.allowCaptainFailTask !== false &&
      totalClues > 0 &&
      visibleCluesCount >= totalClues &&
      canMutateActiveTask,
  }
}

const finishBreakForCaptain = async ({
  game,
  gameTeam,
  gamesTeamsModel,
  isCaptain,
}) => {
  if (game?.allowCaptainFinishBreak === false) {
    return {
      gameTeam,
      result: {
        message: 'Досрочное завершение перерыва отключено организатором игры.',
      },
    }
  }

  if (!isCaptain) {
    return {
      gameTeam,
      result: {
        message: 'Завершить перерыв досрочно может только капитан команды.',
      },
    }
  }

  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const tasksCount = tasks.length
  const breakDurationSeconds = parseDurationSeconds(game?.breakDuration, 0)
  const taskDurationSeconds = parseDurationSeconds(game?.taskDuration, 3600)

  if (tasksCount === 0 || breakDurationSeconds <= 0) {
    return {
      gameTeam,
      result: { message: 'Перерыв для этой игры не предусмотрен.' },
    }
  }

  const nextStep = getNextTaskStep(gameTeam)
  const activeTaskIndex = getActiveSourceTaskIndex(game, gameTeam)
  const nextTaskIndex = getNextSourceTaskIndex(game, gameTeam)

  if (activeTaskIndex === null || nextTaskIndex === null) {
    return {
      gameTeam,
      result: { message: 'Игра уже завершена.' },
    }
  }

  const startTimes = ensureArrayWithLength(gameTeam.startTime, tasksCount, null)
  const endTimes = ensureArrayWithLength(gameTeam.endTime, tasksCount, null)
  const activeTaskStartTime = ensureDateValue(startTimes[activeTaskIndex])
  const activeTaskEndTime = ensureDateValue(endTimes[activeTaskIndex])
  const activeTaskFailure = getTaskFailureEntry(gameTeam, activeTaskIndex)
  const nowMs = Date.now()

  const isBreakAfterCaptainFailureActive =
    activeTaskFailure?.failedAt &&
    Math.max(
      Math.floor((nowMs - activeTaskFailure.failedAt.getTime()) / 1000),
      0,
    ) < breakDurationSeconds
  const isBreakAfterSuccessActive =
    activeTaskEndTime &&
    Math.max(Math.floor((nowMs - activeTaskEndTime.getTime()) / 1000), 0) <
      breakDurationSeconds
  const isBreakAfterTimeoutActive =
    !activeTaskEndTime &&
    activeTaskStartTime &&
    taskDurationSeconds > 0 &&
    (() => {
      const elapsedSinceStart = getEffectiveTaskElapsedSeconds({
        gameTeam,
        taskIndex: activeTaskIndex,
        task: tasks[activeTaskIndex],
        startTime: activeTaskStartTime,
        now: new Date(nowMs),
      })
      return (
        elapsedSinceStart >= taskDurationSeconds &&
        elapsedSinceStart < taskDurationSeconds + breakDurationSeconds
      )
    })()

  if (
    !isBreakAfterCaptainFailureActive &&
    !isBreakAfterSuccessActive &&
    !isBreakAfterTimeoutActive
  ) {
    return {
      gameTeam,
      result: { message: 'Перерыв еще не начался или уже завершен.' },
    }
  }

  const nextStartTimes = ensureArrayWithLength(
    gameTeam.startTime,
    tasksCount,
    null,
  ).map(cloneDateValue)
  nextStartTimes[nextTaskIndex] = new Date()

  const nextForcedClues = ensureArrayWithLength(
    gameTeam.forcedClues,
    tasksCount,
    0,
  ).map((value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : 0
  })
  nextForcedClues[nextTaskIndex] = 0

  const updatedGameTeam = await gamesTeamsModel
    .findByIdAndUpdate(
      gameTeam._id,
      {
        activeNum: nextStep,
        startTime: nextStartTimes,
        forcedClues: nextForcedClues,
      },
      { returnDocument: 'after' },
    )
    .lean()

  return {
    gameTeam: updatedGameTeam ?? {
      ...gameTeam,
      activeNum: nextStep,
      startTime: nextStartTimes,
      forcedClues: nextForcedClues,
    },
    result: {
      message: '<b>Перерыв завершен.</b>',
      messages: ['Перерыв завершен.'],
      shouldResetMessages: true,
    },
  }
}

const forceClueForCaptain = async ({
  game,
  gameTeam,
  gamesTeamsModel,
  isCaptain,
}) => {
  if (game?.allowCaptainForceClue === false) {
    return {
      gameTeam,
      result: {
        message: 'Досрочное получение подсказки отключено организатором игры.',
      },
    }
  }

  if (!isCaptain) {
    return {
      gameTeam,
      result: {
        message: 'Получить подсказку досрочно может только капитан команды.',
      },
    }
  }

  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const tasksCount = tasks.length
  const activeTaskIndex = getActiveSourceTaskIndex(game, gameTeam)

  if (activeTaskIndex === null || activeTaskIndex < 0 || activeTaskIndex >= tasksCount) {
    return {
      gameTeam,
      result: { message: 'Задание уже завершено.' },
    }
  }

  const activeTask = tasks[activeTaskIndex]
  const totalClues = Array.isArray(activeTask?.clues)
    ? activeTask.clues.length
    : 0
  const cluesDurationSeconds = parseDurationSeconds(game?.cluesDuration, 1200)

  if (totalClues <= 0 || cluesDurationSeconds <= 0) {
    return {
      gameTeam,
      result: { message: 'Подсказки для этого задания недоступны.' },
    }
  }

  const startTimes = ensureArrayWithLength(gameTeam.startTime, tasksCount, null)
  const endTimes = ensureArrayWithLength(gameTeam.endTime, tasksCount, null)
  const forcedClues = ensureArrayWithLength(gameTeam.forcedClues, tasksCount, 0)

  if (endTimes[activeTaskIndex]) {
    return {
      gameTeam,
      result: { message: 'Это задание уже выполнено.' },
    }
  }

  if (getTaskFailureEntry(gameTeam, activeTaskIndex)) {
    return {
      gameTeam,
      result: { message: 'Это задание уже слито.' },
    }
  }

  const visibleCluesCount = getVisibleCluesCountForTask({
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
    startTime: startTimes[activeTaskIndex],
    cluesDurationSeconds,
    forcedCluesCount: forcedClues[activeTaskIndex],
  })

  if (visibleCluesCount >= totalClues) {
    return {
      gameTeam,
      result: { message: 'Все подсказки для этого задания уже выданы.' },
    }
  }

  const effectiveElapsedSeconds = getEffectiveTaskElapsedSeconds({
    gameTeam,
    taskIndex: activeTaskIndex,
    task: activeTask,
    startTime: startTimes[activeTaskIndex],
  })
  const nextClueNumber = Math.min(visibleCluesCount + 1, totalClues)
  const clueEarlyAccessFrom = normalizeClueEarlyAccessFrom(
    game?.clueEarlyAccessFrom,
  )

  if (nextClueNumber < clueEarlyAccessFrom) {
    return {
      gameTeam,
      result: {
        message: `Досрочное получение доступно начиная с подсказки №${clueEarlyAccessFrom}.`,
      },
    }
  }

  const mutationBlockReason = getClassicTaskMutationBlockReason({
    game,
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
  })
  if (mutationBlockReason) {
    return {
      gameTeam,
      result: {
        message:
          mutationBlockReason === 'not_started'
            ? 'Задание ещё не началось.'
            : 'Время на задание уже вышло.',
      },
    }
  }
  const secondsUntilNextClue = Math.max(
    nextClueNumber * cluesDurationSeconds - effectiveElapsedSeconds,
    0,
  )

  if (secondsUntilNextClue <= 0) {
    return {
      gameTeam,
      result: { message: 'Подсказка уже доступна. Обновите задание.' },
    }
  }
  const forceClueCost = resolveForceClueCost({
    mode: game?.clueEarlyAccessMode,
    configuredPenaltySeconds: game?.clueEarlyPenalty,
    secondsUntilNextClue,
  })

  const nextForcedClues = [...forcedClues]
  nextForcedClues[activeTaskIndex] = Math.max(
    nextForcedClues[activeTaskIndex] || 0,
    nextClueNumber,
  )

  const existingAddings = Array.isArray(gameTeam.timeAddings)
    ? [...gameTeam.timeAddings]
    : []
  const taskId = getTaskIdValue(activeTask)
  const clueAddingName = `Досрочная подсказка №${nextClueNumber}`
  const hasExistingClueAdding = existingAddings.some((adding) => {
    if (adding?.name !== clueAddingName) return false
    if (taskId && adding?.taskId) return String(adding.taskId) === taskId
    return adding?.taskIndex === activeTaskIndex
  })

  const nextTimeAddings =
    hasExistingClueAdding || forceClueCost.seconds <= 0
      ? existingAddings
      : [
          ...existingAddings,
          {
            name: clueAddingName,
            time: forceClueCost.seconds,
            taskIndex: activeTaskIndex,
            ...(taskId ? { taskId } : {}),
            source: 'captain_force_clue',
            scope: 'task_elapsed',
            showInAdjustments: false,
            createdAt: new Date(),
          },
        ]

  const updatedGameTeam = await gamesTeamsModel
    .findByIdAndUpdate(
      gameTeam._id,
      {
        forcedClues: nextForcedClues,
        timeAddings: nextTimeAddings,
      },
      { returnDocument: 'after' },
    )
    .lean()

  return {
    gameTeam: updatedGameTeam ?? {
      ...gameTeam,
      forcedClues: nextForcedClues,
      timeAddings: nextTimeAddings,
    },
    result: {
      message: `<b>Подсказка №${nextClueNumber} выдана досрочно.</b>${
        forceClueCost.seconds > 0
          ? `<br /><b>${forceClueCost.mode === 'penalty' ? 'Штраф' : 'Добавленное время'}:</b> ${forceClueCost.seconds} сек.`
          : ''
      }`,
      messages: [`Подсказка №${nextClueNumber} выдана досрочно.`],
      shouldResetMessages: true,
    },
  }
}

const failTaskForCaptain = async ({
  game,
  gameTeam,
  gamesTeamsModel,
  isCaptain,
}) => {
  if (game?.allowCaptainFailTask === false) {
    return {
      gameTeam,
      result: { message: 'Слив задания отключен организатором игры.' },
    }
  }

  if (!isCaptain) {
    return {
      gameTeam,
      result: { message: 'Слить задание может только капитан команды.' },
    }
  }

  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const tasksCount = tasks.length
  const activeTaskIndex = getActiveSourceTaskIndex(game, gameTeam)

  if (activeTaskIndex === null || activeTaskIndex < 0 || activeTaskIndex >= tasksCount) {
    return {
      gameTeam,
      result: { message: 'Задание уже завершено.' },
    }
  }

  const startTimes = ensureArrayWithLength(gameTeam.startTime, tasksCount, null)
  const endTimes = ensureArrayWithLength(gameTeam.endTime, tasksCount, null)
  const forcedClues = ensureArrayWithLength(gameTeam.forcedClues, tasksCount, 0)
  const activeTask = tasks[activeTaskIndex]
  const totalClues = Array.isArray(activeTask?.clues)
    ? activeTask.clues.length
    : 0
  const visibleCluesCount = getVisibleCluesCountForTask({
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
    startTime: startTimes[activeTaskIndex],
    cluesDurationSeconds: parseDurationSeconds(game?.cluesDuration, 1200),
    forcedCluesCount: forcedClues[activeTaskIndex],
  })

  if (endTimes[activeTaskIndex]) {
    return {
      gameTeam,
      result: { message: 'Это задание уже выполнено.' },
    }
  }

  if (getTaskFailureEntry(gameTeam, activeTaskIndex)) {
    return {
      gameTeam,
      result: { message: 'Это задание уже слито.' },
    }
  }

  const mutationBlockReason = getClassicTaskMutationBlockReason({
    game,
    gameTeam,
    task: activeTask,
    taskIndex: activeTaskIndex,
  })
  if (mutationBlockReason) {
    return {
      gameTeam,
      result: {
        message:
          mutationBlockReason === 'not_started'
            ? 'Задание ещё не началось.'
            : 'Время на задание уже вышло.',
      },
    }
  }

  if (totalClues <= 0 || visibleCluesCount < totalClues) {
    return {
      gameTeam,
      result: {
        message: 'Слить задание можно только после получения всех подсказок.',
      },
    }
  }

  const failedAt = new Date()
  const nextStep = getNextTaskStep(gameTeam)
  const nextTaskIndex = getNextSourceTaskIndex(game, gameTeam)
  const breakDurationSeconds = parseDurationSeconds(game?.breakDuration, 0)
  const existingFailures = normalizeTaskFailures(gameTeam.taskFailures)
  const nextTaskFailures = [
    ...existingFailures,
    {
      taskIndex: activeTaskIndex,
      taskId:
        activeTask?._id !== null && activeTask?._id !== undefined
          ? String(activeTask._id)
          : '',
      failedAt,
      source: 'captain',
      reason: 'captain_fail_task',
    },
  ]

  const updates = {
    taskFailures: nextTaskFailures,
  }

  if (breakDurationSeconds <= 0 || nextTaskIndex === null) {
    const nextStartTimes = ensureArrayWithLength(
      gameTeam.startTime,
      tasksCount,
      null,
    ).map(cloneDateValue)
    if (nextTaskIndex !== null) {
      nextStartTimes[nextTaskIndex] = failedAt
    }

    const nextForcedClues = ensureArrayWithLength(
      gameTeam.forcedClues,
      tasksCount,
      0,
    ).map((value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : 0
    })
    if (nextTaskIndex !== null) {
      nextForcedClues[nextTaskIndex] = 0
    }

    updates.activeNum = nextStep
    updates.startTime = nextStartTimes
    updates.forcedClues = nextForcedClues
  }

  const updatedGameTeam = await gamesTeamsModel
    .findByIdAndUpdate(gameTeam._id, updates, { returnDocument: 'after' })
    .lean()

  return {
    gameTeam: updatedGameTeam ?? { ...gameTeam, ...updates },
    result: {
      message: '<b>Задание провалено по решению команды.</b>',
      messages: ['Задание провалено по решению команды.'],
      shouldResetMessages:
        breakDurationSeconds <= 0 || nextTaskIndex === null,
    },
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

  const maybeHandleAutomaticProgressOnce = async (teamState) => {
    if (!teamState || tasksCount === 0) return teamState

    const activeNumValue = getActiveTaskStep(teamState)
    const activeTaskIndex = getActiveSourceTaskIndex(game, teamState)

    if (activeNumValue >= tasksCount || activeTaskIndex === null) {
      return teamState
    }

    const nextStep = activeNumValue + 1
    const nextIndex = getTaskIndexForStep(game, teamState, nextStep)
    const hasNextTask = nextIndex !== null

    const startTimes = ensureArrayWithLength(
      teamState.startTime,
      tasksCount,
      null,
    )
    const endTimes = ensureArrayWithLength(teamState.endTime, tasksCount, null)
    const activeFailure = getTaskFailureEntry(teamState, activeTaskIndex)

    const activeStart = ensureDateValue(startTimes[activeTaskIndex])
    const activeEnd = ensureDateValue(endTimes[activeTaskIndex])
    const nowMs = Date.now()

    const buildTimeoutFailureUpdates = (
      taskIndex,
      failedAt,
      extraUpdates = {},
    ) => {
      const existingFailures = normalizeTaskFailures(teamState.taskFailures)
      const hasExistingFailure = existingFailures.some(
        (item) => item.taskIndex === taskIndex,
      )

      if (hasExistingFailure) {
        return extraUpdates
      }

      return {
        ...extraUpdates,
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

    const getTimeoutFailedAt = () =>
      new Date(
        activeStart.getTime() +
          Math.max(
            taskDurationSeconds -
              getClueAdvanceSecondsForTask({
                gameTeam: teamState,
                taskIndex: activeTaskIndex,
                task: tasks[activeTaskIndex],
              }),
            0,
          ) *
            1000,
      )

    const updateActiveNum = async (nextActiveNum, extraUpdates = {}) => {
      const updates = { activeNum: nextActiveNum, ...extraUpdates }
      const updatedTeam = await gamesTeamsModel
        .findByIdAndUpdate(teamState._id, updates, { returnDocument: 'after' })
        .lean()

      return updatedTeam ?? { ...teamState, ...updates }
    }

    if (!hasNextTask) {
      if (activeEnd) {
        return updateActiveNum(nextStep)
      }

      if (activeStart && taskDurationSeconds > 0) {
        const elapsedSinceStart = getEffectiveTaskElapsedSeconds({
          gameTeam: teamState,
          taskIndex: activeTaskIndex,
          task: tasks[activeTaskIndex],
          startTime: activeStart,
          now: new Date(nowMs),
        })

        if (elapsedSinceStart >= taskDurationSeconds) {
          const failedAt = getTimeoutFailedAt()
          return updateActiveNum(
            nextStep,
            buildTimeoutFailureUpdates(activeTaskIndex, failedAt),
          )
        }
      }

      return teamState
    }

    const advanceToNextTask = async (
      startedAt = new Date(nowMs),
      extraUpdates = {},
    ) => {
      const nextStartedAt = ensureDateValue(startedAt) || new Date(nowMs)
      const startTimeUpdates = ensureArrayWithLength(
        teamState.startTime,
        tasksCount,
        null,
      ).map(cloneDateValue)
      startTimeUpdates[nextIndex] = nextStartedAt

      const forcedCluesUpdates = ensureArrayWithLength(
        teamState.forcedClues,
        tasksCount,
        0,
      ).map((value) => (Number.isFinite(value) ? value : 0))
      forcedCluesUpdates[nextIndex] = 0

      return updateActiveNum(nextStep, {
        ...extraUpdates,
        startTime: startTimeUpdates,
        forcedClues: forcedCluesUpdates,
      })
    }

    if (activeFailure?.failedAt) {
      if (breakDurationSeconds <= 0) {
        return advanceToNextTask(activeFailure.failedAt)
      }

      const elapsedAfterFailure = Math.max(
        Math.floor((nowMs - activeFailure.failedAt.getTime()) / 1000),
        0,
      )

      if (elapsedAfterFailure >= breakDurationSeconds) {
        autoProgressMessages.push('<b>Перерыв завершён.</b>')
        return advanceToNextTask(
          new Date(
            activeFailure.failedAt.getTime() + breakDurationSeconds * 1000,
          ),
        )
      }

      return teamState
    }

    if (activeEnd) {
      if (breakDurationSeconds <= 0) {
        return advanceToNextTask(activeEnd)
      }

      const elapsedAfterEnd = Math.max(
        Math.floor((nowMs - activeEnd.getTime()) / 1000),
        0,
      )

      if (elapsedAfterEnd >= breakDurationSeconds) {
        return advanceToNextTask(
          new Date(activeEnd.getTime() + breakDurationSeconds * 1000),
        )
      }

      return teamState
    }

    if (activeStart && taskDurationSeconds > 0) {
      const elapsedSinceStart = getEffectiveTaskElapsedSeconds({
          gameTeam: teamState,
          taskIndex: activeTaskIndex,
          task: tasks[activeTaskIndex],
          startTime: activeStart,
        now: new Date(nowMs),
      })

      if (elapsedSinceStart >= taskDurationSeconds) {
        if (breakDurationSeconds > 0) {
          const failedAt = getTimeoutFailedAt()

          if (elapsedSinceStart >= taskDurationSeconds + breakDurationSeconds) {
            autoProgressMessages.push('<b>Перерыв завершён.</b>')
            return advanceToNextTask(
              new Date(failedAt.getTime() + breakDurationSeconds * 1000),
              buildTimeoutFailureUpdates(activeTaskIndex, failedAt),
            )
          }

          return updateActiveNum(
            activeNumValue,
            buildTimeoutFailureUpdates(activeTaskIndex, failedAt),
          )
        } else {
          autoProgressMessages.push('<b>Время на задание вышло.</b>')
          const failedAt = getTimeoutFailedAt()
          return advanceToNextTask(
            failedAt,
            buildTimeoutFailureUpdates(activeTaskIndex, failedAt),
          )
        }
      }
    }

    return teamState
  }

  let effectiveGameTeam = gameTeam

  for (let guard = 0; guard < tasksCount + 1; guard += 1) {
    const previousActiveNum = Number.isInteger(effectiveGameTeam?.activeNum)
      ? effectiveGameTeam.activeNum
      : 0
    const previousStartTimeSignature = JSON.stringify(
      Array.isArray(effectiveGameTeam?.startTime)
        ? effectiveGameTeam.startTime.map(
            (value) => ensureDateValue(value)?.toISOString() || null,
          )
        : [],
    )

    const nextGameTeam =
      await maybeHandleAutomaticProgressOnce(effectiveGameTeam)
    effectiveGameTeam = nextGameTeam || effectiveGameTeam

    const nextActiveNum = Number.isInteger(effectiveGameTeam?.activeNum)
      ? effectiveGameTeam.activeNum
      : 0
    const nextStartTimeSignature = JSON.stringify(
      Array.isArray(effectiveGameTeam?.startTime)
        ? effectiveGameTeam.startTime.map(
            (value) => ensureDateValue(value)?.toISOString() || null,
          )
        : [],
    )

    if (
      nextActiveNum === previousActiveNum &&
      nextStartTimeSignature === previousStartTimeSignature
    ) {
      break
    }
  }

  const activeNumRaw = getActiveTaskStep(effectiveGameTeam)

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
      const lastTaskIndex = getTaskIndexForStep(
        game,
        effectiveGameTeam,
        tasksCount - 1,
      )
      const lastTask =
        lastTaskIndex !== null ? tasks[lastTaskIndex] : tasks[tasksCount - 1]
      const finishingPlace = getGameProcessFinishingPlace(game)
      const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
      if (finishingPlace) {
        completionParts.push(
          `<br /><br /><b>Точка сбора:</b> ${finishingPlace}`,
        )
      }
      const lastTaskPostMessage = getTaskPostCompletionMessage(lastTask)
      if (lastTaskPostMessage) {
        postCompletionMessage = lastTaskPostMessage
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

      const activeTaskIndex = getActiveSourceTaskIndex(game, effectiveGameTeam)
      if (activeTaskIndex === null) {
        taskHtml = '<b>Поздравляем! Вы завершили игру.</b>'
        taskState = 'completed'
      } else {
      const activeTaskEndTime = ensureDateValue(endTimes[activeTaskIndex])
      const activeTaskStartTime = ensureDateValue(startTimes[activeTaskIndex])
      const activeTaskFailure = getTaskFailureEntry(
        effectiveGameTeam,
        activeTaskIndex,
      )

      let breakSecondsLeft = null
      let breakReason = null

      if (breakDurationSeconds > 0) {
        const nowMs = Date.now()

        if (activeTaskFailure?.failedAt) {
          const elapsed = Math.max(
            Math.floor((nowMs - activeTaskFailure.failedAt.getTime()) / 1000),
            0,
          )
          if (elapsed < breakDurationSeconds) {
            breakSecondsLeft = breakDurationSeconds - elapsed
            breakReason = 'captain_failed'
          }
        } else if (activeTaskEndTime) {
          const elapsed = Math.max(
            Math.floor((nowMs - activeTaskEndTime.getTime()) / 1000),
            0,
          )
          if (elapsed < breakDurationSeconds) {
            breakSecondsLeft = breakDurationSeconds - elapsed
            breakReason = 'success'
          }
        } else if (activeTaskStartTime && taskDurationSeconds > 0) {
          const elapsedSinceStart = getEffectiveTaskElapsedSeconds({
            gameTeam: effectiveGameTeam,
            taskIndex: activeTaskIndex,
            task: tasks[activeTaskIndex],
            startTime: activeTaskStartTime,
            now: new Date(nowMs),
          })
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
        const postMessage = getTaskPostCompletionMessage(tasks[activeTaskIndex])
        if (postMessage) {
          postCompletionMessage = postMessage
        }
        const breakTargetTimestamp = Date.now() + breakSecondsLeft * 1000
        const hiddenBreakCountdown = `<span style="display:none" aria-hidden="true"><span data-task-countdown="break" data-refresh-on-complete="true" data-target="${breakTargetTimestamp}" data-seconds="${Math.max(Math.floor(breakSecondsLeft), 0)}"></span></span>`
        const breakParts = [
          breakReason === 'captain_failed'
            ? '<b>Задание провалено по решению команды.</b>'
            : breakReason === 'timeout'
              ? '<b>Время на задание вышло.</b>'
              : '<b>Задание выполнено.</b>',
        ]
        breakParts.push('<br /><br /><b>Ожидайте следующее задание.</b>')
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
          elapsedSeconds = getEffectiveTaskElapsedSeconds({
            gameTeam: effectiveGameTeam,
            taskIndex: activeTaskIndex,
            task: tasks[activeTaskIndex],
            startTime: activeTaskStartTime,
          })
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

        if (activeNumRaw > 0) {
          const previousTaskIndex = getTaskIndexForStep(
            game,
            effectiveGameTeam,
            activeNumRaw - 1,
          )
          const previousTask =
            previousTaskIndex !== null ? tasks[previousTaskIndex] : null
          const previousPostMessage = getTaskPostCompletionMessage(previousTask)
          if (previousPostMessage) {
            postCompletionMessage = previousPostMessage
          }
        }
      }
      }
    }
  }

  if (!taskHtml && (hasCompletedAllTasks || isGameFinished) && tasksCount > 0) {
    const lastTaskIndex = getTaskIndexForStep(
      game,
      effectiveGameTeam,
      tasksCount - 1,
    )
    const lastTask =
      lastTaskIndex !== null ? tasks[lastTaskIndex] : tasks[tasksCount - 1]
    const finishingPlace = getGameProcessFinishingPlace(game)
    const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
    if (finishingPlace) {
      completionParts.push(`<br /><br /><b>Точка сбора:</b> ${finishingPlace}`)
    }
    const lastTaskPostMessage = getTaskPostCompletionMessage(lastTask)
    if (lastTaskPostMessage) {
      postCompletionMessage = lastTaskPostMessage
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
  action,
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

    const membershipResolution = resolveTeamMembershipForIdentity({
      teamUsers,
      userId,
      telegramId,
    })
    const isTeamMember = membershipResolution.isTeamMember
    const isCaptain = membershipResolution.isCaptain

    gameTaskDebugLog('membership_resolved', {
      gameId: String(gameId || ''),
      teamId: String(teamId || ''),
      userId: userId ? String(userId) : null,
      telegramId: telegramId ? String(telegramId) : null,
      matchedBy: membershipResolution.matchedBy,
      matchedMemberships: Array.isArray(membershipResolution.matchedMemberships)
        ? membershipResolution.matchedMemberships.map((item) => ({
            id: item?._id ? String(item._id) : '',
            userId: item?.userId ? String(item.userId) : null,
            userTelegramId:
              item?.userTelegramId !== null &&
              item?.userTelegramId !== undefined
                ? String(item.userTelegramId)
                : null,
            role: typeof item?.role === 'string' ? item.role : null,
          }))
        : [],
      isTeamMember,
      isCaptain,
    })

    if (!isTeamMember) {
      console.error('[game-task-access] TEAM_ACCESS_DENIED', {
        gameId: String(gameId || ''),
        teamId: String(teamId || ''),
        userId: userId ? String(userId) : null,
        telegramId: telegramId ? String(telegramId) : null,
        teamUsersCount: Array.isArray(teamUsers) ? teamUsers.length : 0,
        matchedBy: membershipResolution.matchedBy,
      })
      return buildError(GAME_TASK_ERRORS.TEAM_ACCESS_DENIED, {
        statusCode: 403,
        game: safeSerializeGameForClient(game),
        team: safeSerialize(team),
        status,
        isGameStarted,
        isGameFinished,
      })
    }

    let processResult = null

    try {
      const captainActionHandler =
        action === 'finishBreak'
          ? finishBreakForCaptain
          : action === 'forceClue'
            ? forceClueForCaptain
            : action === 'failTask'
              ? failTaskForCaptain
              : null

      if (
        captainActionHandler &&
        !canMutateClassicGameProgress(game?.status)
      ) {
        processResult = {
          message: 'Капитанские действия доступны только во время запущенной игры.',
        }
      } else if (captainActionHandler) {
        const expectedActiveStep = getActiveTaskStep(gameTeam)
        const lock = isCaptain
          ? await acquireGameProcessLock({
              GamesTeams: gamesTeamsModel,
              teamId: gameTeam._id,
            })
          : null

        if (isCaptain && !lock?.acquired) {
          processResult = {
            message:
              'Другой ответ команды ещё обрабатывается. Подождите несколько секунд и повторите действие.',
            retryable: true,
          }
        } else {
          try {
            const actionGameTeam = lock?.gameTeam || gameTeam
            const currentActiveStep = getActiveTaskStep(actionGameTeam)

            if (
              lock?.acquired &&
              didGameProcessStepChange(expectedActiveStep, currentActiveStep)
            ) {
              gameTeam = actionGameTeam
              processResult = {
                message:
                  'Задание уже изменилось. Обновите экран перед повторным действием.',
                staleState: true,
              }
            } else {
              const actionResult = await captainActionHandler({
                game,
                gameTeam: actionGameTeam,
                gamesTeamsModel,
                isCaptain,
              })
              gameTeam = actionResult.gameTeam || actionGameTeam
              processResult = actionResult.result
            }
          } finally {
            if (lock?.acquired) {
              try {
                await releaseGameProcessLock({
                  GamesTeams: gamesTeamsModel,
                  teamId: gameTeam._id,
                  token: lock.token,
                })
              } catch (error) {
                console.error('Failed to release captain action lock', error)
              }
            }
          }
        }
      } else {
        processResult = await webGameProcess({
          db,
          game,
          gameTeam,
          gameTeamId: gameTeam._id,
          location,
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
      }
    } catch (processError) {
      console.error('Game process execution error', processError)
      processResult = {
        message: 'Не удалось получить текущее состояние задания.',
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
      effectiveGameTeam,
    } = await computeTaskHtml({
      game,
      gameTeam,
      processResult,
      isGameStarted,
      isGameFinished,
      gamesTeamsModel,
    })

    await notifyAgentsForGameTeamProgress({
      db,
      game,
      gameTeam: effectiveGameTeam || gameTeam,
      team,
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
        captainActions: buildCaptainActionsForState({
          game,
          gameTeam: effectiveGameTeam || gameTeam,
          isCaptain,
        }),
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
