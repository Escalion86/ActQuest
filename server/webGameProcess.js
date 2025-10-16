import getSecondsBetween from '@helpers/getSecondsBetween'
import createTaskProgressArrays, {
  createTaskPhotoEntry,
  createTaskPhotosArray,
} from '@helpers/createTaskProgressArrays'
import ensureArrayCapacity from '@helpers/ensureArrayCapacity'
import removeCluePenalties from '@helpers/removeCluePenalties'
import secondsToTime from 'telegram/func/secondsToTime'
import taskText from 'telegram/func/taskText'

const PROMPT_TEXT = {
  classic: 'ВВЕДИТЕ КОД',
  photo: 'ОТПРАВТЕ ФОТО',
}

const createPromptMessage = (gameType) => {
  const label = PROMPT_TEXT[gameType] || PROMPT_TEXT.classic
  return `<b>${label}</b>`
}

const ensureDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Krasnoyarsk',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const timeToCodeStr = () => timeFormatter.format(new Date()).replace(':', '')

const endTaskForIndex = (endTime, taskIndex, tasksLength) => {
  const endTimeTemp = ensureArrayCapacity(endTime, tasksLength)
  endTimeTemp[taskIndex] = new Date()
  return endTimeTemp
}

const prepareNextTaskStart = (startTime, taskIndex, tasksLength) => {
  const startTimeTemp = ensureArrayCapacity(startTime, tasksLength)
  if (taskIndex < tasksLength - 1) {
    startTimeTemp[taskIndex + 1] = new Date()
  }
  return startTimeTemp
}

const resetForcedClueForTask = (forcedClues, taskIndex, tasksLength) => {
  if (taskIndex < 0 || taskIndex >= tasksLength) return null
  const forcedCluesTemp = ensureArrayCapacity(forcedClues, tasksLength, 0)
  forcedCluesTemp[taskIndex] = 0
  return forcedCluesTemp
}

const initializeTeamProgress = async (gameTeam, game, GamesTeams) => {
  const { _id: gameTeamId, timeAddings } = gameTeam
  const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const startTime = new Array(tasksCount).fill(null)
  if (tasksCount > 0) {
    startTime[0] = new Date()
  }
  const endTime = new Array(tasksCount).fill(null)
  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
  } = createTaskProgressArrays(tasksCount)

  const filteredAddings = removeCluePenalties(timeAddings)

  await GamesTeams.findByIdAndUpdate(gameTeamId, {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
    timeAddings: filteredAddings,
    forcedClues: new Array(tasksCount).fill(0),
  })
}

const buildBreakMessage = ({ code, task, breakDuration }) => {
  const parts = [
    `<b>КОД "${code}" ПРИНЯТ.</b>`,
    '<br /><br /><b>Задание выполнено!</b>',
  ]

  if (task?.postMessage) {
    parts.push(
      `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${task.postMessage}</blockquote>`
    )
  }

  parts.push('<br /><br /><b>ПЕРЕРЫВ.</b>')

  if (Number.isFinite(breakDuration) && breakDuration > 0) {
    parts.push(
      `<br /><br /><b>Время до окончания перерыва:</b> ${secondsToTime(
        breakDuration
      )}`
    )
  }

  return parts.join('')
}

const buildGameFinishedMessage = (game) => {
  const { tasks = [], finishingPlace } = game || {}
  const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null

  const parts = ['Поздравляем Вы завершили все задания! Игра окончена.']

  if (finishingPlace) {
    parts.push(`Вы можете выдвигаться на точку сбора: ${finishingPlace}`)
  }

  if (lastTask?.postMessage) {
    parts.push(
      `<b>Сообщение от прошлого задания:</b><br /><blockquote>${lastTask.postMessage}</blockquote>`
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
}) => {
  const totalClues = Array.isArray(task?.clues) ? task.clues.length : 0
  if (totalClues === 0) return 0

  const startDate = ensureDate(startTime)
  const elapsedSeconds = startDate ? Math.max(getSecondsBetween(startDate), 0) : 0

  const timedClues = cluesDuration > 0 ? Math.floor(elapsedSeconds / cluesDuration) : 0
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

/**
 * Обработчик игрового процесса для web-кабинета.
 * Логика повторяет telegram-версию, но избавлена от кнопок и рассылок,
 * а также старается возвращать структурированные ответы специально для web UI.
 */
const webGameProcess = async ({
  db,
  game,
  gameTeam,
  gameTeamId,
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

  if (resolvedGame.status === 'active') {
    return { message: 'Игра ещё не началась.' }
  }

  if (resolvedGame.status === 'finished') {
    return { message: 'Игра завершена.' }
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

  const activeIndexRaw = Number.isInteger(resolvedGameTeam.activeNum)
    ? resolvedGameTeam.activeNum
    : 0
  const activeTaskIndex = Math.min(Math.max(activeIndexRaw, 0), tasksCount - 1)
  const currentTask = tasks[activeTaskIndex]

  if (!currentTask) {
    return { message: buildGameFinishedMessage(resolvedGame) }
  }

  const codeInput = typeof message === 'string' ? message.trim() : ''
  if (!codeInput) {
    // Возврат null даёт понять интерфейсу, что новых сообщений нет.
    return null
  }

  const normalizedCode = codeInput.toLowerCase()

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
  if (findedBonusCodesInTask.includes(normalizedCode)) {
    return { message: 'Вы уже нашли этот бонусный код. Хотите ещё?' }
  }

  if (findedPenaltyCodesInTask.includes(normalizedCode)) {
    return { message: 'Вы уже нашли этот штрафной код. Хотите ещё?' }
  }

  if (findedCodesInTask.includes(normalizedCode)) {
    return { message: 'Такой код уже найден. Введите другой код.' }
  }

  // Обработка бонусных кодов.
  const bonusCode = bonusCodes.find(
    ({ code }) => code?.toLowerCase() === normalizedCode
  )
  if (bonusCode) {
    const nextBonusProgress = [...findedBonusCodes]
    nextBonusProgress[activeTaskIndex] = [
      ...findedBonusCodesInTask,
      normalizedCode,
    ]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      findedBonusCodes: nextBonusProgress,
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
    ({ code }) => code?.toLowerCase() === normalizedCode
  )
  if (penaltyCode) {
    const nextPenaltyProgress = [...findedPenaltyCodes]
    nextPenaltyProgress[activeTaskIndex] = [
      ...findedPenaltyCodesInTask,
      normalizedCode,
    ]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      findedPenaltyCodes: nextPenaltyProgress,
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

  const normalizedCodes = taskCodes.map((code) =>
    typeof code === 'string' ? code.toLowerCase() : String(code || '')
  )

  const isDynamicTimeCode =
    normalizedCodes[0] === '[time]' && timeToCodeStr() === normalizedCode

  const isCorrectCode =
    normalizedCodes.includes(normalizedCode) || isDynamicTimeCode

  // Если код не подходит ни к одной категории — фиксируем ошибку.
  if (!isCorrectCode) {
    const nextWrongProgress = [...wrongCodes]
    nextWrongProgress[activeTaskIndex] = [...wrongCodesInTask, normalizedCode]

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
      wrongCodes: nextWrongProgress,
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

  const requiredCodes = currentTask.numCodesToCompliteTask ?? taskCodes.length
  const isTaskComplete =
    nextFindedProgress[activeTaskIndex].length >= requiredCodes

  let updates = { findedCodes: nextFindedProgress }

  if (isTaskComplete) {
    const endTimeTemp = endTaskForIndex(endTime, activeTaskIndex, tasksCount)
    const startTimeTemp = prepareNextTaskStart(
      startTime,
      activeTaskIndex,
      tasksCount
    )

    const nextTaskIndex = activeTaskIndex + 1

    // Если следующее задание отсутствует — игра завершена.
    if (nextTaskIndex >= tasksCount) {
      const forcedCluesTemp = resetForcedClueForTask(
        forcedClues,
        nextTaskIndex,
        tasksCount
      )

      updates = {
        ...updates,
        startTime: startTimeTemp,
        endTime: endTimeTemp,
        activeNum: nextTaskIndex,
        ...(forcedCluesTemp ? { forcedClues: forcedCluesTemp } : {}),
      }

      await GamesTeams.findByIdAndUpdate(effectiveTeamId, updates)

      return {
        message: buildGameFinishedMessage(resolvedGame),
        messages: ['Поздравляем! Вы завершили игру.'],
      }
    }

    // При активном перерыве выводим сообщение и оставляем команду на паузе.
    if (breakDuration > 0) {
      await GamesTeams.findByIdAndUpdate(effectiveTeamId, {
        findedCodes: nextFindedProgress,
        endTime: endTimeTemp,
      })

      return {
        message: buildBreakMessage({
          code: codeInput,
          task: currentTask,
          breakDuration,
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
      activeNum: nextTaskIndex,
      ...(forcedCluesTemp ? { forcedClues: forcedCluesTemp } : {}),
    }

    await GamesTeams.findByIdAndUpdate(effectiveTeamId, updates)

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
      }),
      includeActionPrompt: false,
      format: 'web',
    })

    return createBaseResponse({
      statusMessage: `КОД "${codeInput}" ПРИНЯТ`,
      followUpMessage,
      promptMessage: createPromptMessage(resolvedGame.type),
      images: tasks[nextTaskIndex]?.images,
    })
  }

  await GamesTeams.findByIdAndUpdate(effectiveTeamId, updates)

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

export default webGameProcess
