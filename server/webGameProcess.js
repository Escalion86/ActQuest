import getSecondsBetween from '@helpers/getSecondsBetween'
import createTaskProgressArrays, {
  createTaskPhotoEntry,
  createTaskPhotosArray,
} from '@helpers/createTaskProgressArrays'
import ensureArrayCapacity from '@helpers/ensureArrayCapacity'
import getGameProcessFinishingPlace from '@helpers/getGameProcessFinishingPlace'
import getLocationTimeZone from '@helpers/locationTimeZone'
import sanitize from '@helpers/sanitize'
import { getTaskIndexForStep } from '@helpers/taskDistribution'
import {
  canMutateClassicGameProgress,
  getClassicTaskMutationBlockReason,
  normalizeClassicCode,
  resolveRequiredMainCodesCount,
} from '@helpers/classicGameRules'
import {
  acquireGameProcessLock,
  didGameProcessStepChange,
  releaseGameProcessLock,
} from '@server/gameProcessLock'
import taskText from 'telegram/func/taskText'

const PROMPT_TEXT = {
  classic: 'ВВЕДИТЕ КОД',
  photo: 'ОТПРАВТЕ ФОТО',
}

const createPromptMessage = (gameType) => {
  const label = PROMPT_TEXT[gameType] || PROMPT_TEXT.classic
  return `<b>${label}</b>`
}

const sanitizeFragment = (value) => sanitize(String(value || ''))

const getTaskPostCompletionMessage = (task) => {
  const rich =
    typeof task?.postMessageRich === 'string' ? task.postMessageRich.trim() : ''
  const plain = typeof task?.postMessage === 'string' ? task.postMessage.trim() : ''
  return rich || plain
}

const ensureDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const timeToCodeStr = (location) => {
  const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: getLocationTimeZone(location),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return timeFormatter.format(new Date()).replace(':', '')
}

const endTaskForIndex = (endTime, taskIndex, tasksLength) => {
  const endTimeTemp = ensureArrayCapacity(endTime, tasksLength)
  endTimeTemp[taskIndex] = new Date()
  return endTimeTemp
}

const prepareTaskStart = (startTime, taskIndex, tasksLength) => {
  const startTimeTemp = ensureArrayCapacity(startTime, tasksLength)
  if (taskIndex >= 0 && taskIndex < tasksLength) {
    startTimeTemp[taskIndex] = new Date()
  }
  return startTimeTemp
}

const resetForcedClueForTask = (forcedClues, taskIndex, tasksLength) => {
  if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= tasksLength) {
    return null
  }
  const forcedCluesTemp = ensureArrayCapacity(forcedClues, tasksLength, 0)
  forcedCluesTemp[taskIndex] = 0
  return forcedCluesTemp
}

const initializeTeamProgress = async (gameTeam, game, GamesTeams) => {
  const { _id: gameTeamId } = gameTeam
  const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const startTime = new Array(tasksCount).fill(null)
  const firstTaskIndex = getTaskIndexForStep(game, gameTeam, 0)
  if (firstTaskIndex !== null) {
    startTime[firstTaskIndex] = new Date()
  }
  const endTime = new Array(tasksCount).fill(null)
  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
  } = createTaskProgressArrays(tasksCount)

  await GamesTeams.findByIdAndUpdate(gameTeamId, {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    codeAttempts: [],
    photos,
    timeAddings: [],
    forcedClues: new Array(tasksCount).fill(0),
    taskFailures: [],
    storyProgress: null,
  })
}

const buildBreakMessage = ({ code, task }) => {
  const parts = [
    `<b>КОД "${code}" ПРИНЯТ.</b>`,
    '<br /><br /><b>Задание выполнено!</b>',
  ]

  if (task?.postMessage) {
    parts.push(
      `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${sanitizeFragment(
        task.postMessage
      )}</blockquote>`
    )
  }

  parts.push('<br /><br /><b>ПЕРЕРЫВ.</b>')

  return parts.join('')
}

const buildGameFinishedMessage = (game) => {
  const { tasks = [] } = game || {}
  const finishingPlace = getGameProcessFinishingPlace(game)
  const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null

  const parts = ['Поздравляем Вы завершили все задания! Игра окончена.']

  if (finishingPlace) {
    parts.push(`Вы можете выдвигаться на точку сбора: ${finishingPlace}`)
  }

  if (lastTask?.postMessage) {
    parts.push(
      `<b>Сообщение от прошлого задания:</b><br /><blockquote>${sanitizeFragment(
        lastTask.postMessage
      )}</blockquote>`
    )
  }

  return parts.join('\n\n')
}

const createBaseResponse = ({
  statusMessage,
  followUpMessage,
  promptMessage,
  images,
}) => {
  const messages = []
  if (statusMessage) messages.push(statusMessage)
  if (promptMessage) messages.push(promptMessage)

  return {
    message: statusMessage || followUpMessage || promptMessage || '',
    followUpMessage: followUpMessage || null,
    promptMessage: promptMessage || null,
    images,
    messages,
  }
}

const collectVisibleCluesCount = ({
  task,
  cluesDuration,
  startTime,
  forcedClues,
  timeAddings,
  taskIndex,
}) => {
  const totalClues = Array.isArray(task?.clues) ? task.clues.length : 0
  if (totalClues === 0) return 0

  const startDate = ensureDate(startTime)
  const elapsedSeconds = startDate ? Math.max(getSecondsBetween(startDate), 0) : 0
  const taskId = task?._id !== null && task?._id !== undefined ? String(task._id) : ''
  const clueAdvanceSeconds = Array.isArray(timeAddings)
    ? timeAddings.reduce((sum, adding) => {
        const source = typeof adding?.source === 'string' ? adding.source : ''
        const name = typeof adding?.name === 'string' ? adding.name : ''
        const isCaptainForceClue =
          source === 'captain_force_clue' ||
          name.startsWith('Досрочная подсказка')
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
    : 0

  const timedClues =
    cluesDuration > 0
      ? Math.floor((elapsedSeconds + clueAdvanceSeconds) / cluesDuration)
      : 0
  const forcedCluesCount = Math.max(forcedClues || 0, 0)

  return Math.min(totalClues, Math.max(timedClues, forcedCluesCount))
}

const preparePhotosProgress = (photos, taskIndex, tasksCount) => {
  const normalizedPhotos = Array.isArray(photos)
    ? [...photos]
    : createTaskPhotosArray(tasksCount)

  if (!normalizedPhotos[taskIndex]) {
    normalizedPhotos[taskIndex] = createTaskPhotoEntry()
  }

  return normalizedPhotos
}

const buildCodeAttemptEntry = ({ taskIndex, code, category, status, source }) => ({
  taskIndex,
  code: String(code || '').trim().toLowerCase(),
  category,
  status,
  source,
  createdAt: new Date(),
})

/**
 * Обработчик игрового процесса для web-кабинета.
 * Логика повторяет telegram-версию, но избавлена от кнопок и рассылок,
 * а также старается возвращать структурированные ответы специально для web UI.
 */
const webGameProcessUnlocked = async ({
  db,
  game,
  gameTeam,
  gameTeamId,
  location,
  message,
}) => {
  if (!db) {
    return { message: 'Нет подключения к базе данных.' }
  }

  const GamesTeams = db.model('GamesTeams')
  const Games = db.model('Games')

  const effectiveTeamId = gameTeamId || gameTeam?._id
  if (!effectiveTeamId) {
    return { message: 'Команда не найдена.' }
  }

  let resolvedGameTeam =
    gameTeam || (await GamesTeams.findById(effectiveTeamId).lean())

  if (!resolvedGameTeam) {
    return { message: 'Команда не найдена.' }
  }

  const resolvedGame =
    game || (await Games.findById(resolvedGameTeam.gameId).lean())

  if (!resolvedGame) {
    return { message: 'Игра не найдена.' }
  }

  if (!canMutateClassicGameProgress(resolvedGame.status)) {
    const statusMessages = {
      active: 'Игра ещё не началась.',
      finished: 'Игра завершена.',
      closed: 'Игра завершена.',
      canceled: 'Игра отменена.',
    }
    return {
      message:
        statusMessages[resolvedGame.status] ||
        'Игровой процесс сейчас недоступен.',
    }
  }

  const tasks = Array.isArray(resolvedGame.tasks) ? resolvedGame.tasks : []
  const tasksCount = tasks.length

  if (tasksCount === 0) {
    return { message: 'Для этой игры ещё не добавлены задания.' }
  }

  const shouldStartGame =
    !resolvedGameTeam.startTime || resolvedGameTeam.startTime.length === 0

  if (shouldStartGame) {
    await initializeTeamProgress(resolvedGameTeam, resolvedGame, GamesTeams)
    resolvedGameTeam = await GamesTeams.findById(effectiveTeamId).lean()
  }

  const {
    startTime = [],
    endTime = [],
    findedCodes = [],
    wrongCodes = [],
    findedBonusCodes = [],
    findedPenaltyCodes = [],
    photos = [],
    timeAddings = [],
    forcedClues = [],
  } = resolvedGameTeam

  const breakDuration = Number.isFinite(resolvedGame.breakDuration)
    ? Math.max(resolvedGame.breakDuration, 0)
    : 0
  const taskDuration = Number.isFinite(resolvedGame.taskDuration)
    ? Math.max(resolvedGame.taskDuration, 0)
    : 3600
  const cluesDuration = Number.isFinite(resolvedGame.cluesDuration)
    ? Math.max(resolvedGame.cluesDuration, 0)
    : 1200

  const activeStep = Number.isInteger(resolvedGameTeam.activeNum)
    ? resolvedGameTeam.activeNum
    : 0
  const activeTaskIndex = getTaskIndexForStep(
    resolvedGame,
    resolvedGameTeam,
    activeStep,
  )
  if (activeTaskIndex === null) {
    return { message: buildGameFinishedMessage(resolvedGame) }
  }
  const currentTask = tasks[activeTaskIndex]

  if (!currentTask) {
    return { message: buildGameFinishedMessage(resolvedGame) }
  }

  const codeInput = typeof message === 'string' ? message.trim() : ''
  if (!codeInput) {
    // Возврат null даёт понять интерфейсу, что новых сообщений нет.
    return null
  }

  const normalizedCode = normalizeClassicCode(codeInput)

  if (resolvedGame.type === 'photo') {
    const photosProgress = preparePhotosProgress(
      photos,
      activeTaskIndex,
      tasksCount
    )

    photosProgress[activeTaskIndex].photos.push(codeInput)

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      photos: photosProgress,
    })

    const followUpMessage = taskText({
      game: resolvedGame,
      taskNum: activeTaskIndex,
      startTaskTime: startTime[activeTaskIndex],
      cluesDuration,
      taskDuration,
      photos: photosProgress,
      timeAddings,
      visibleCluesCount: collectVisibleCluesCount({
        task: currentTask,
        cluesDuration,
        startTime: startTime[activeTaskIndex],
        forcedClues: forcedClues[activeTaskIndex],
        timeAddings,
        taskIndex: activeTaskIndex,
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    return createBaseResponse({
      statusMessage: 'Фото-ответ получен!',
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
    })
  }

  const mutationBlockReason = getClassicTaskMutationBlockReason({
    game: resolvedGame,
    gameTeam: resolvedGameTeam,
    task: currentTask,
    taskIndex: activeTaskIndex,
  })

  if (mutationBlockReason) {
    const messages = {
      not_started: 'Задание ещё не началось. Обновите экран.',
      completed: 'Задание уже выполнено. Обновите экран.',
      failed: 'Задание уже завершено как невыполненное. Обновите экран.',
      timeout: 'Время на задание уже вышло. Код не был принят.',
    }

    return {
      message: messages[mutationBlockReason],
      staleState: true,
    }
  }

  const taskCodes = Array.isArray(currentTask.codes) ? currentTask.codes : []
  const penaltyCodes = Array.isArray(currentTask.penaltyCodes)
    ? currentTask.penaltyCodes
    : []
  const bonusCodes = Array.isArray(currentTask.bonusCodes)
    ? currentTask.bonusCodes
    : []

  const findedCodesInTask = Array.isArray(findedCodes[activeTaskIndex])
    ? [...findedCodes[activeTaskIndex]]
    : []
  const wrongCodesInTask = Array.isArray(wrongCodes[activeTaskIndex])
    ? [...wrongCodes[activeTaskIndex]]
    : []
  const findedBonusCodesInTask = Array.isArray(
    findedBonusCodes[activeTaskIndex]
  )
    ? [...findedBonusCodes[activeTaskIndex]]
    : []
  const findedPenaltyCodesInTask = Array.isArray(
    findedPenaltyCodes[activeTaskIndex]
  )
    ? [...findedPenaltyCodes[activeTaskIndex]]
    : []

  // Проверяем, что код не вводился ранее участниками команды.
  if (
    findedBonusCodesInTask.some(
      (value) => normalizeClassicCode(value) === normalizedCode,
    )
  ) {
    return { message: 'Вы уже нашли этот бонусный код. Хотите ещё?' }
  }

  if (
    findedPenaltyCodesInTask.some(
      (value) => normalizeClassicCode(value) === normalizedCode,
    )
  ) {
    return { message: 'Вы уже нашли этот штрафной код. Хотите ещё?' }
  }

  if (
    findedCodesInTask.some(
      (value) => normalizeClassicCode(value) === normalizedCode,
    )
  ) {
    return { message: 'Такой код уже найден. Введите другой код.' }
  }

  // Обработка бонусных кодов.
  const bonusCode = bonusCodes.find(
    ({ code }) => normalizeClassicCode(code) === normalizedCode
  )
  if (bonusCode) {
    const nextBonusProgress = [...findedBonusCodes]
    nextBonusProgress[activeTaskIndex] = [
      ...findedBonusCodesInTask,
      normalizedCode,
    ]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      $set: {
        findedBonusCodes: nextBonusProgress,
      },
      $push: {
        codeAttempts: buildCodeAttemptEntry({
          taskIndex: activeTaskIndex,
          code: normalizedCode,
          category: 'bonus',
          status: 'accepted',
          source: 'web',
        }),
      },
    })

    const followUpMessage = taskText({
      game: resolvedGame,
      taskNum: activeTaskIndex,
      findedCodes,
      findedBonusCodes: nextBonusProgress,
      findedPenaltyCodes,
      startTaskTime: startTime[activeTaskIndex],
      cluesDuration,
      taskDuration,
      timeAddings,
      visibleCluesCount: collectVisibleCluesCount({
        task: currentTask,
        cluesDuration,
        startTime: startTime[activeTaskIndex],
        forcedClues: forcedClues[activeTaskIndex],
        timeAddings,
        taskIndex: activeTaskIndex,
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    return createBaseResponse({
      statusMessage: `КОД "${codeInput}" - БОНУСНЫЙ!`,
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
      images: currentTask.images,
    })
  }

  // Обработка штрафных кодов.
  const penaltyCode = penaltyCodes.find(
    ({ code }) => normalizeClassicCode(code) === normalizedCode
  )
  if (penaltyCode) {
    const nextPenaltyProgress = [...findedPenaltyCodes]
    nextPenaltyProgress[activeTaskIndex] = [
      ...findedPenaltyCodesInTask,
      normalizedCode,
    ]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      $set: {
        findedPenaltyCodes: nextPenaltyProgress,
      },
      $push: {
        codeAttempts: buildCodeAttemptEntry({
          taskIndex: activeTaskIndex,
          code: normalizedCode,
          category: 'penalty',
          status: 'accepted',
          source: 'web',
        }),
      },
    })

    const followUpMessage = taskText({
      game: resolvedGame,
      taskNum: activeTaskIndex,
      findedCodes,
      findedBonusCodes,
      findedPenaltyCodes: nextPenaltyProgress,
      startTaskTime: startTime[activeTaskIndex],
      cluesDuration,
      taskDuration,
      timeAddings,
      visibleCluesCount: collectVisibleCluesCount({
        task: currentTask,
        cluesDuration,
        startTime: startTime[activeTaskIndex],
        forcedClues: forcedClues[activeTaskIndex],
        timeAddings,
        taskIndex: activeTaskIndex,
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    return createBaseResponse({
      statusMessage: `КОД "${codeInput}" - ШТРАФНОЙ!<br />Описание штрафа: "${
        penaltyCode.description || ''
      }"`,
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
      images: currentTask.images,
    })
  }

  const normalizedCodes = taskCodes.map(normalizeClassicCode).filter(Boolean)

  const isDynamicTimeCode =
    normalizedCodes[0] === '[time]' &&
    timeToCodeStr(resolvedGame.location || location) === normalizedCode

  const isCorrectCode =
    normalizedCodes.includes(normalizedCode) || isDynamicTimeCode

  // Если код не подходит ни к одной категории — фиксируем ошибку.
  if (!isCorrectCode) {
    const nextWrongProgress = [...wrongCodes]
    nextWrongProgress[activeTaskIndex] = [...wrongCodesInTask, normalizedCode]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      $set: {
        wrongCodes: nextWrongProgress,
      },
      $push: {
        codeAttempts: buildCodeAttemptEntry({
          taskIndex: activeTaskIndex,
          code: normalizedCode,
          category: 'wrong',
          status: 'rejected',
          source: 'web',
        }),
      },
    })

    const followUpMessage = taskText({
      game: resolvedGame,
      taskNum: activeTaskIndex,
      findedCodes,
      findedBonusCodes,
      findedPenaltyCodes,
      startTaskTime: startTime[activeTaskIndex],
      cluesDuration,
      taskDuration,
      timeAddings,
      visibleCluesCount: collectVisibleCluesCount({
        task: currentTask,
        cluesDuration,
        startTime: startTime[activeTaskIndex],
        forcedClues: forcedClues[activeTaskIndex],
        timeAddings,
        taskIndex: activeTaskIndex,
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    return createBaseResponse({
      statusMessage: `Код "${codeInput}" не верен.`,
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
    })
  }

  const nextFindedProgress = [...findedCodes]
  nextFindedProgress[activeTaskIndex] = [
    ...findedCodesInTask,
    normalizedCode,
  ]

  const requiredCodes = resolveRequiredMainCodesCount(currentTask)
  const acceptedMainCodesCount = new Set(
    nextFindedProgress[activeTaskIndex]
      .map(normalizeClassicCode)
      .filter(Boolean),
  ).size
  const isTaskComplete =
    acceptedMainCodesCount >= requiredCodes

  let updates = { findedCodes: nextFindedProgress }

  if (isTaskComplete) {
    const endTimeTemp = endTaskForIndex(endTime, activeTaskIndex, tasksCount)
    const nextStep = activeStep + 1
    const nextTaskIndex = getTaskIndexForStep(
      resolvedGame,
      resolvedGameTeam,
      nextStep,
    )
    const startTimeTemp =
      nextTaskIndex !== null
        ? prepareTaskStart(startTime, nextTaskIndex, tasksCount)
        : ensureArrayCapacity(startTime, tasksCount)

    // Если следующее задание отсутствует — игра завершена.
    if (nextTaskIndex === null) {
      const lastTaskPostMessage = getTaskPostCompletionMessage(currentTask)
      const forcedCluesTemp = resetForcedClueForTask(
        forcedClues,
        nextTaskIndex,
        tasksCount
      )

      updates = {
        ...updates,
        startTime: startTimeTemp,
        endTime: endTimeTemp,
        activeNum: nextStep,
        ...(forcedCluesTemp ? { forcedClues: forcedCluesTemp } : {}),
      }

      await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
        $set: updates,
        $push: {
          codeAttempts: buildCodeAttemptEntry({
            taskIndex: activeTaskIndex,
            code: normalizedCode,
            category: 'main',
            status: 'accepted',
            source: 'web',
          }),
        },
      })

      return {
        message: buildGameFinishedMessage(resolvedGame),
        messages: [
          'Поздравляем! Вы завершили игру.',
          lastTaskPostMessage,
        ].filter(Boolean),
      }
    }

    // При активном перерыве выводим сообщение и оставляем команду на паузе.
    if (breakDuration > 0) {
      await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
        $set: {
          findedCodes: nextFindedProgress,
          endTime: endTimeTemp,
        },
        $push: {
          codeAttempts: buildCodeAttemptEntry({
            taskIndex: activeTaskIndex,
            code: normalizedCode,
            category: 'main',
            status: 'accepted',
            source: 'web',
          }),
        },
      })

      return {
        message: buildBreakMessage({
          code: codeInput,
          task: currentTask,
        }),
        messages: [`КОД "${codeInput}" ПРИНЯТ.`],
      }
    }

    const forcedCluesTemp = resetForcedClueForTask(
      forcedClues,
      nextTaskIndex,
      tasksCount
    )

    updates = {
      ...updates,
      startTime: startTimeTemp,
      endTime: endTimeTemp,
      activeNum: nextStep,
      ...(forcedCluesTemp ? { forcedClues: forcedCluesTemp } : {}),
    }

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      $set: updates,
      $push: {
        codeAttempts: buildCodeAttemptEntry({
          taskIndex: activeTaskIndex,
          code: normalizedCode,
          category: 'main',
          status: 'accepted',
          source: 'web',
        }),
      },
    })

    const nextForcedClues = forcedCluesTemp
      ? forcedCluesTemp[nextTaskIndex]
      : forcedClues[nextTaskIndex]

    const followUpMessage = taskText({
      game: resolvedGame,
      taskNum: nextTaskIndex,
      findedCodes: nextFindedProgress,
      findedBonusCodes,
      findedPenaltyCodes,
      startTaskTime: startTimeTemp[nextTaskIndex],
      cluesDuration,
      taskDuration,
      timeAddings,
      visibleCluesCount: collectVisibleCluesCount({
        task: tasks[nextTaskIndex],
        cluesDuration,
        startTime: startTimeTemp[nextTaskIndex],
        forcedClues: nextForcedClues,
        timeAddings,
        taskIndex: nextTaskIndex,
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    const baseResponse = createBaseResponse({
      statusMessage: `КОД "${codeInput}" ПРИНЯТ`,
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
      images: tasks[nextTaskIndex]?.images,
    })

    return {
      ...baseResponse,
      shouldResetMessages: true,
    }
  }

  await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
    $set: updates,
    $push: {
      codeAttempts: buildCodeAttemptEntry({
        taskIndex: activeTaskIndex,
        code: normalizedCode,
        category: 'main',
        status: 'accepted',
        source: 'web',
      }),
    },
  })

  const followUpMessage = taskText({
    game: resolvedGame,
    taskNum: activeTaskIndex,
    findedCodes: nextFindedProgress,
    findedBonusCodes,
    findedPenaltyCodes,
    startTaskTime: startTime[activeTaskIndex],
    cluesDuration,
    taskDuration,
    timeAddings,
    visibleCluesCount: collectVisibleCluesCount({
      task: currentTask,
      cluesDuration,
      startTime: startTime[activeTaskIndex],
      forcedClues: forcedClues[activeTaskIndex],
      timeAddings,
      taskIndex: activeTaskIndex,
    }),
    includeActionPrompt: false,
    format: 'web',
  })

  return createBaseResponse({
    statusMessage: `КОД "${codeInput}" ПРИНЯТ`,
    followUpMessage,
    promptMessage: createPromptMessage(resolvedGame.type),
    images: currentTask.images,
  })
}

const webGameProcess = async (options) => {
  const { db, gameTeam, gameTeamId, message } = options || {}

  if (!db) {
    return { message: 'Нет подключения к базе данных.' }
  }

  const effectiveTeamId = gameTeamId || gameTeam?._id
  if (!effectiveTeamId) {
    return { message: 'Команда не найдена.' }
  }

  const hasMessage = typeof message === 'string' && message.trim().length > 0
  const needsInitialization =
    !Array.isArray(gameTeam?.startTime) || gameTeam.startTime.length === 0

  // Обычное обновление экрана не пишет прогресс и не должно ждать блокировку.
  if (!hasMessage && !needsInitialization) {
    return webGameProcessUnlocked(options)
  }

  const GamesTeams = db.model('GamesTeams')
  const expectedActiveStep = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : 0
  const lock = await acquireGameProcessLock({
    GamesTeams,
    teamId: effectiveTeamId,
  })

  if (!lock.acquired) {
    return {
      message:
        'Другой ответ команды ещё обрабатывается. Подождите несколько секунд и повторите ввод.',
      retryable: true,
    }
  }

  try {
    const currentActiveStep = Number.isInteger(lock.gameTeam?.activeNum)
      ? lock.gameTeam.activeNum
      : 0

    // Код был введён для предыдущего задания, пока другой запрос уже перевёл
    // команду дальше. Не применяем его к новому заданию автоматически.
    if (
      hasMessage &&
      didGameProcessStepChange(expectedActiveStep, currentActiveStep)
    ) {
      return {
        message:
          'Задание уже изменилось. Проверьте новое задание и введите подходящий код ещё раз.',
        staleState: true,
      }
    }

    return await webGameProcessUnlocked({
      ...options,
      gameTeam: lock.gameTeam,
      gameTeamId: effectiveTeamId,
    })
  } finally {
    try {
      await releaseGameProcessLock({
        GamesTeams,
        teamId: effectiveTeamId,
        token: lock.token,
      })
    } catch (error) {
      console.error('Failed to release game process lock', error)
    }
  }
}

export default webGameProcess
