import getSecondsBetween from '@helpers/getSecondsBetween'
import createTaskProgressArrays, {
  createTaskPhotoEntry,
  createTaskPhotosArray,
} from '@helpers/createTaskProgressArrays'
import ensureArrayCapacity from '@helpers/ensureArrayCapacity'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import keyboardFormer from 'telegram/func/keyboardFormer'
import taskText from 'telegram/func/taskText'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'
import secondsToTime from 'telegram/func/secondsToTime'
import secondsToTimeStr from '@helpers/secondsToTimeStr'

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Krasnoyarsk',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const timeToCodeStr = () => timeFormatter.format(new Date()).replace(':', '')

const endTimeSet = (endTime, taskNum, gameTasksLength) => {
  const newDate = new Date()
  const endTimeTemp = ensureArrayCapacity(endTime, gameTasksLength)
  endTimeTemp[taskNum] = newDate
  return endTimeTemp
}

const startTimeNextSet = (startTime, taskNum, gameTasksLength) => {
  // var endTimeTemp = endTime
  const newDate = new Date()
  const startTimeTemp = ensureArrayCapacity(startTime, gameTasksLength)
  if (taskNum < gameTasksLength - 1) {
    startTimeTemp[taskNum + 1] = newDate
  }
  return startTimeTemp
}

const resetForcedClueForTask = (forcedClues, taskIndex, gameTasksLength) => {
  if (taskIndex < 0 || taskIndex >= gameTasksLength) return null

  const forcedCluesTemp = ensureArrayCapacity(forcedClues, gameTasksLength, 0)
  forcedCluesTemp[taskIndex] = 0
  return forcedCluesTemp
}

const teamGameStart = async (gameTeamId, game, GamesTeams) => {
  const gameTasksCount = game.tasks.length
  const startTime = new Array(gameTasksCount).fill(null)
  startTime[0] = new Date()
  const endTime = new Array(gameTasksCount).fill(null)
  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
  } = createTaskProgressArrays(gameTasksCount)
  await GamesTeams.findByIdAndUpdate(gameTeamId, {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
    timeAddings: [],
    forcedClues: new Array(gameTasksCount).fill(0),
  })
}

const gameProcess = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  let gameTeam = await getGameTeam(jsonCommand?.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const GamesTeams = db.model('GamesTeams')
  const TeamsUsers = db.model('TeamsUsers')

  // Если игра не стартовала или уже закончена
  if (game.status === 'active') {
    return {
      message: 'Игра не стартовала',
      nextCommand: { c: 'game', gameId: gameTeam.gameId },
    }
  }

  if (game.status === 'finished') {
    return {
      message: 'Игра завершена',
      nextCommand: { c: 'game', gameId: gameTeam.gameId },
    }
  }

  // Если начало игры индивидуальное, то нужно создать запись в БД для старта
  const shouldStartGame = !gameTeam.startTime || gameTeam.startTime.length === 0
  if (shouldStartGame) {
    await teamGameStart(gameTeam._id, game, GamesTeams)
    gameTeam = await getGameTeam(jsonCommand?.gameTeamId, db)
  }

  const teamUsers = await TeamsUsers.find({ teamId: gameTeam.teamId })

  const getTeamUserByTelegramId = (id) =>
    teamUsers.find(
      ({ userTelegramId }) => String(userTelegramId) === String(id)
    )

  const currentTeamUser = getTeamUserByTelegramId(telegramId)
  const isCaptainRole = (role) => role === 'capitan'
  const isCaptain = isCaptainRole(currentTeamUser?.role)
  const telegramIdStr = String(telegramId ?? '')

  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    activeNum,
    startTime,
    endTime,
    photos,
    timeAddings,
    forcedClues,
  } = gameTeam

  const breakDuration = game.breakDuration ?? 0
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const allowCaptainFinishBreak = game.allowCaptainFinishBreak !== false

  const taskNum = activeNum ?? 0

  const gameType = game?.type || 'classic'
  const buildGameFinishedMessage = () =>
    `Поздравляем Вы завершили все задания! Игра окончена. ${
      game.finishingPlace
        ? `Вы можете выдвигаться на точку сбора: ${game.finishingPlace}`
        : ''
    }${
      game.tasks[game.tasks.length - 1].postMessage
        ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${
            game.tasks[game.tasks.length - 1].postMessage
          }</blockquote>`
        : ''
    }`

  const justStartedGame = shouldStartGame

  const buttonRefresh = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: '\u{1F504} Обновить',
    },
  ]

  const buttonFinishBreak = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        finishBreak: true,
      },
      text: 'Завершить перерыв',
    },
  ]

  const buttonConfirmFinishBreak = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        finishBreak: true,
        confirmFinishBreak: true,
      },
      text: 'Да, завершить перерыв',
    },
  ]

  const buttonCancelFinishBreak = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: 'Нет, продолжить перерыв',
    },
  ]

  const buildBreakButtons = ({ includeCaptainActions } = {}) => {
    const allowCaptainActions =
      typeof includeCaptainActions === 'boolean'
        ? includeCaptainActions
        : Boolean(isCaptain)
    const canFinishBreak = allowCaptainActions && allowCaptainFinishBreak
    return canFinishBreak ? [buttonFinishBreak, buttonRefresh] : [buttonRefresh]
  }

  const buttonSeePhotoAnswers = [
    {
      c: { seePhotoAnswers: true },
      text: '\u{1F4F7} Посмотреть фото-ответы на задание',
    },
  ]

  const buttonConfirmForceClue = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        forceClue: true,
        confirmForceClue: true,
      },
      text: 'Да, получить подсказку',
    },
  ]

  const buttonCancelForceClue = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: 'Нет, продолжить задание',
    },
  ]

  const buttonConfirmFailTask = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        failTask: true,
        confirmFailTask: true,
      },
      text: 'Да, слить задание',
    },
  ]

  const buttonCancelFailTask = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: 'Нет, продолжить задание',
    },
  ]

  const secondsLeftAfterStartTask = getSecondsBetween(startTime[taskNum])
  const hasEndTime = Boolean(endTime[taskNum])
  const secondsAfterEndTime = hasEndTime
    ? getSecondsBetween(endTime[taskNum])
    : 0
  const isBreakAfterSuccessActive =
    hasEndTime && breakDuration > 0 && secondsAfterEndTime < breakDuration
  const isBreakAfterTimeoutActive =
    !hasEndTime &&
    breakDuration > 0 &&
    secondsLeftAfterStartTask > taskDuration &&
    secondsLeftAfterStartTask < taskDuration + breakDuration

  if (jsonCommand.finishBreak) {
    if (!allowCaptainFinishBreak)
      return {
        message:
          'Досрочное завершение перерыва отключено организатором игры.',
        buttons: buildBreakButtons({ includeCaptainActions: false }),
      }

    if (!isCaptain)
      return {
        message: 'Завершить перерыв досрочно может только капитан команды.',
        buttons: buildBreakButtons({ includeCaptainActions: false }),
      }

    if (!jsonCommand.confirmFinishBreak) {
      return {
        message:
          'Вы уверены, что хотите завершить перерыв и получить следующее задание?',
        buttons: [buttonConfirmFinishBreak, buttonCancelFinishBreak],
      }
    }

    if (breakDuration <= 0)
      return {
        message: 'Перерыв для этой игры не предусмотрен.',
        buttons: buildBreakButtons(),
      }

    if (!isBreakAfterSuccessActive && !isBreakAfterTimeoutActive)
      return {
        message: 'Перерыв еще не начался или уже завершен.',
        buttons: buildBreakButtons(),
      }

    const startTimeTemp = startTimeNextSet(
      startTime,
      taskNum,
      game.tasks.length
    )

    const nextTaskNum = taskNum + 1
    const forcedCluesTemp = resetForcedClueForTask(
      forcedClues,
      nextTaskNum,
      game.tasks.length
    )

    const updates = {
      startTime: startTimeTemp,
      activeNum: nextTaskNum,
    }
    if (forcedCluesTemp) updates.forcedClues = forcedCluesTemp

    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

    if (nextTaskNum > game.tasks.length - 1)
      return {
        message: buildGameFinishedMessage(),
        nextCommand: 'mainMenu',
      }

    return {
      message: '<b>Перерыв завершен.</b>',
      nextCommand: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
      },
    }
  }

  // Если больше заданий нет (все выполнены или последнее провалено)
  if (
    taskNum > game.tasks.length - 1 ||
    (taskNum === game.tasks.length - 1 &&
      secondsLeftAfterStartTask >= taskDuration)
  ) {
    return {
      message: buildGameFinishedMessage(),
      nextCommand: 'mainMenu',
    }
  }

  // Если задание было закончено успешно и идет перерыв
  // выдаем сообщение об остатке времени,
  // либо если перерыв окончен, то даем след задание

  if (endTime[taskNum] && breakDuration > 0) {
    if (secondsAfterEndTime < breakDuration)
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>\n\n`
            : ''
        }<b>ПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
          breakDuration - secondsAfterEndTime
        )}`}`,
        buttons: buildBreakButtons(),
      }
    else {
      const startTimeTemp = startTimeNextSet(
        startTime,
        taskNum,
        game.tasks.length
      )
      const forcedCluesTemp = resetForcedClueForTask(
        forcedClues,
        taskNum + 1,
        game.tasks.length
      )

      const updates = {
        // findedCodes: newAllFindedCodes,
        startTime: startTimeTemp,
        // endTime: endTimeTemp,
        activeNum: taskNum + 1,
      }
      if (forcedCluesTemp) updates.forcedClues = forcedCluesTemp

      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

      const message = taskText({
        game,
        taskNum: taskNum + 1,
        // findedCodes,
        // startTaskTime: startTime[activeNum + 1],
        cluesDuration,
        taskDuration,
        timeAddings,
      })
      return {
        images: game.tasks[taskNum + 1].images,
        message,
        buttons: buttonRefresh,
      }
    }
  }

  // Если задание небыло закончено и идет перерыв
  // выдаем сообщение об остатке времени,
  // либо если перерыв окончен, то даем след задание

  // Проверяем не вышло ли время
  if (secondsLeftAfterStartTask > taskDuration) {
    // Проверяем есть ли перерыв и если есть то закончился ли
    if (
      !endTime[taskNum] &&
      breakDuration > 0 &&
      secondsLeftAfterStartTask < taskDuration + breakDuration
    ) {
      // ПЕРЕРЫВ
      // const endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)
      // await dbConnect()
      // await db.model('GamesTeams').findByIdAndUpdate(jsonCommand?.gameTeamId, {
      //   // findedCodes: newAllFindedCodes,
      //   // startTime: startTimeTemp,
      //   endTime: endTimeTemp,
      //   // activeNum: activeNum + 1,
      // })
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>\n\n`
            : ''
        }<b>Время вышло\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
          taskDuration + breakDuration - secondsLeftAfterStartTask
        )}`}`,
        buttons: buildBreakButtons(),
      }
    }

    const startTimeTemp = startTimeNextSet(
      startTime,
      taskNum,
      game.tasks.length
    )

    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      // findedCodes: newAllFindedCodes,
      startTime: startTimeTemp,
      // endTime: endTimeTemp,
      activeNum: taskNum + 1,
    })

    if (breakDuration > 0)
      return {
        message: '<b>Перерыв закончен</b>',
        nextCommand: {},
      }

    return {
      message: '<b>Время вышло</b>',
      nextCommand: {},
    }
  }

  const currentTask = game.tasks[taskNum] ?? {}
  const currentTaskId = currentTask?._id ? String(currentTask._id) : null
  const totalClues =
    Array.isArray(currentTask.clues) && currentTask.clues.length > 0
      ? currentTask.clues.length
      : 0
  const rawShowCluesNum =
    cluesDuration > 0
      ? Math.floor(secondsLeftAfterStartTask / cluesDuration)
      : 0
  const showCluesNum = Math.min(Math.max(rawShowCluesNum, 0), totalClues)
  const cluePenalty = game.clueEarlyPenalty ?? 0
  const allowCaptainForceClue = game.allowCaptainForceClue !== false
  const allowCaptainFailTask = game.allowCaptainFailTask !== false
  const forcedCluesCount = Math.max(forcedClues?.[taskNum] ?? 0, 0)
  const visibleCluesCount = Math.min(
    totalClues,
    Math.max(showCluesNum, forcedCluesCount)
  )

  const filteredPhotos =
    gameType === 'photo'
      ? photos[taskNum]?.photos.filter((photo) => photo) || []
      : []

  if (gameType === 'photo' && !jsonCommand.isPhoto && jsonCommand.message) {
    return {
      message:
        `В качестве ответа на задание необходимо отправить фотографию!\n\n` +
        taskText({
          game,
          taskNum: taskNum,
          startTaskTime: startTime[taskNum],
          cluesDuration,
          taskDuration,
          photos,
          timeAddings,
          visibleCluesCount,
        }),
      buttons: [
        buttonRefresh,
        ...(filteredPhotos.length > 0 ? [buttonSeePhotoAnswers] : []),
      ],
      // nextCommand: 'mainMenu',
    }
  }

  const buttonForceClue = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        forceClue: true,
      },
      text: '\u{26A1} Подсказка досрочно',
    },
  ]

  const buttonFailTask = [
    {
      c: {
        c: 'gameProcess',
        gameTeamId: String(gameTeam._id),
        failTask: true,
      },
      text: '\u{1F6A8} Слить задание',
    },
  ]

  const buildTaskButtons = (
    visibleCount = visibleCluesCount,
    { includeCaptainActions } = {}
  ) => {
    const allowCaptainActions =
      includeCaptainActions ?? Boolean(isCaptain)
    const allowForceClueButton =
      allowCaptainActions && allowCaptainForceClue
    const allowFailTaskButton =
      allowCaptainActions && allowCaptainFailTask
    const hasMoreClues =
      allowForceClueButton &&
      cluesDuration > 0 &&
      totalClues > 0 &&
      visibleCount < totalClues
    const allCluesReceived =
      allowFailTaskButton &&
      totalClues > 0 &&
      visibleCount >= totalClues
    return [
      buttonRefresh,
      ...(hasMoreClues ? [buttonForceClue] : []),
      ...(allCluesReceived ? [buttonFailTask] : []),
    ]
  }

  const sendTaskToOtherMembers = async ({
    message,
    imagesForTask,
    visibleCluesCount: visibleCluesOverride = visibleCluesCount,
    includePhotoButtons = false,
  } = {}) => {
    if (!justStartedGame || !message) return

    const recipients = teamUsers.filter(
      ({ userTelegramId }) => String(userTelegramId) !== telegramIdStr
    )

    if (recipients.length === 0) return

    await Promise.all(
      recipients.map((teamUser) => {
        const buttonsForMember = [
          ...buildTaskButtons(visibleCluesOverride, {
            includeCaptainActions: isCaptainRole(teamUser.role),
          }),
          ...(includePhotoButtons && filteredPhotos.length > 0
            ? [buttonSeePhotoAnswers]
            : []),
        ]

        return sendMessage({
          chat_id: teamUser.userTelegramId,
          text: message,
          keyboard: keyboardFormer(buttonsForMember),
          images: imagesForTask,
          location,
        })
      })
    )
  }

  if (jsonCommand.forceClue) {
    if (!allowCaptainForceClue)
      return {
        message: 'Досрочное получение подсказки отключено организатором игры.',
        buttons: buildTaskButtons(visibleCluesCount, {
          includeCaptainActions: false,
        }),
      }
    if (!isCaptain)
      return {
        message:
          'Получить подсказку досрочно может только капитан команды.',
        buttons: buildTaskButtons(visibleCluesCount, {
          includeCaptainActions: false,
        }),
      }

    if (!jsonCommand.confirmForceClue) {
      const penaltyNotice =
        cluePenalty > 0
          ? `\nШтраф за досрочную подсказку: ${secondsToTimeStr(
              cluePenalty,
              true
            )}`
          : ''

      return {
        message:
          `Вы уверены, что хотите получить подсказку досрочно?${penaltyNotice}`,
        buttons: [buttonConfirmForceClue, buttonCancelForceClue],
      }
    }

    if (cluesDuration <= 0 || totalClues === 0)
      return {
        message: '<b>Подсказки для этого задания недоступны.</b>',
        buttons: buildTaskButtons(visibleCluesCount),
      }

    if (visibleCluesCount >= totalClues)
      return {
        message: 'Все подсказки для этого задания уже выданы.',
        buttons: buildTaskButtons(visibleCluesCount),
      }

    const existingAddings = Array.isArray(timeAddings)
      ? [...timeAddings]
      : []
    const forcedCluesList = Array.isArray(forcedClues)
      ? [...forcedClues]
      : []
    const currentForcedCount = Math.max(forcedCluesList[taskNum] ?? 0, 0)
    const nextForcedCount = Math.min(
      totalClues,
      Math.max(currentForcedCount, Math.max(currentForcedCount, showCluesNum) + 1)
    )

    forcedCluesList[taskNum] = nextForcedCount

    const forcedClueNumber = Math.min(visibleCluesCount + 1, totalClues)
    const clueAddingName = `Досрочная подсказка №${forcedClueNumber}`

    const updates = {
      forcedClues: forcedCluesList,
    }

    const hasExistingCluePenalty = existingAddings.some(
      ({ name, taskIndex, taskId }) => {
        if (name !== clueAddingName) return false
        if (taskId && currentTaskId) return taskId === currentTaskId
        if (typeof taskIndex === 'number') return taskIndex === taskNum
        return false
      }
    )

    if (cluePenalty > 0 && !hasExistingCluePenalty) {
      const newAdding = { name: clueAddingName, time: cluePenalty, taskIndex: taskNum }
      if (currentTaskId) newAdding.taskId = currentTaskId

      updates.timeAddings = [...existingAddings, newAdding]
    }

    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

    const nextVisibleCluesCount = Math.min(
      totalClues,
      Math.max(nextForcedCount, showCluesNum)
    )
    const nextTimeAddings = updates.timeAddings ?? timeAddings

    const penaltyText =
      cluePenalty > 0
        ? `\n<b>Штраф</b>: ${secondsToTimeStr(cluePenalty, true)}`
        : ''

    return {
      images: currentTask.images,
      message: `<b>Подсказка №${forcedClueNumber} выдана досрочно</b>${penaltyText}\n\n${taskText({
        game,
        taskNum,
        findedCodes,
        findedBonusCodes,
        findedPenaltyCodes,
        startTaskTime: startTime[taskNum],
        cluesDuration,
        taskDuration,
        photos,
        timeAddings: nextTimeAddings,
        visibleCluesCount: nextVisibleCluesCount,
      })}`,
      buttons: buildTaskButtons(nextVisibleCluesCount),
    }
  }

  if (jsonCommand.failTask) {
    if (!allowCaptainFailTask)
      return {
        message: 'Слив задания отключен организатором игры.',
        buttons: buildTaskButtons(visibleCluesCount, {
          includeCaptainActions: false,
        }),
      }
    if (!isCaptain)
      return {
        message: 'Слить задание может только капитан команды.',
        buttons: buildTaskButtons(visibleCluesCount, {
          includeCaptainActions: false,
        }),
      }

    if (totalClues > 0 && visibleCluesCount < totalClues)
      return {
        message:
          'Слить задание можно только после получения всех подсказок.',
        buttons: buildTaskButtons(visibleCluesCount),
      }

    const failMessageBase =
      '<b>Задание провалено по решению команды.</b>'
    const failPenaltyNotice =
      '\nШтраф за невыполнение задания будет учтен при подсчете результатов.'

    if (!jsonCommand.confirmFailTask)
      return {
        message: `Вы уверены, что хотите слить задание?${failPenaltyNotice}`,
        buttons: [buttonConfirmFailTask, buttonCancelFailTask],
      }

    if (breakDuration > 0) {
      const endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)

      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        endTime: endTimeTemp,
      })

      const postTaskMessage = game.tasks[taskNum].postMessage
        ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>`
        : ''

      return {
        message: `${failMessageBase}${postTaskMessage}\n\n<b>ПЕРЕРЫВ</b>\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
          breakDuration
        )}${failPenaltyNotice}`,
        buttons: buildBreakButtons(),
      }
    }

    const startTimeTemp = startTimeNextSet(
      startTime,
      taskNum,
      game.tasks.length
    )
    const forcedCluesTemp = resetForcedClueForTask(
      forcedClues,
      taskNum + 1,
      game.tasks.length
    )

    const updates = {
      startTime: startTimeTemp,
      activeNum: taskNum + 1,
    }
    if (forcedCluesTemp) updates.forcedClues = forcedCluesTemp

    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

    return {
      message: `${failMessageBase}${failPenaltyNotice}`,
      nextCommand: {},
    }
  }

  const {
    task,
    codes,
    numCodesToCompliteTask,
    images,
    penaltyCodes,
    bonusCodes,
  } = currentTask

  if (gameType === 'photo') {
    // Если получаем фото-ответ на задание
    if (jsonCommand.isPhoto) {
      const existedPhotos =
        typeof photos?.length === 'number'
          ? [...photos]
          : createTaskPhotosArray(gameTasksCount)
      if (!existedPhotos[taskNum]) {
        existedPhotos[taskNum] = createTaskPhotoEntry()
      }
      existedPhotos[taskNum].photos.push(jsonCommand.message)

      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        photos: existedPhotos,
      })

      return {
        message:
          'Фото-ответ получен!\nВремя на задание еще не завершилось, вы можете сделать еще снимок, удовлетворяющий максимальному числу доп. заданий\n\n' +
          taskText({
            game,
            taskNum: taskNum,
            startTaskTime: startTime[taskNum],
            cluesDuration,
            taskDuration,
            photos: existedPhotos,
            timeAddings,
            visibleCluesCount,
          }),
        // images: [jsonCommand.message],
        buttons: [...buildTaskButtons(visibleCluesCount), buttonSeePhotoAnswers],
      }
    }

    const message = taskText({
      game,
      taskNum: taskNum,
      startTaskTime: startTime[taskNum],
      cluesDuration,
      taskDuration,
      photos,
      timeAddings,
      visibleCluesCount,
    })

    await sendTaskToOtherMembers({
      message,
      visibleCluesCount,
      includePhotoButtons: filteredPhotos.length > 0,
    })

    return {
      message,
      images:
        jsonCommand.seePhotoAnswers &&
        !jsonCommand.isPhoto &&
        !jsonCommand.isVideo &&
        !jsonCommand.isDocument &&
        !jsonCommand.message
          ? filteredPhotos
          : undefined,
      buttons: [
        ...buildTaskButtons(visibleCluesCount),
        ...(filteredPhotos.length > 0 ? [buttonSeePhotoAnswers] : []),
      ],
    }
  }

  if (gameType === 'classic') {
    const code = jsonCommand.message
      ? jsonCommand.message.trim().toLowerCase()
      : undefined

    if (!code) {
      const message = taskText({
        game,
        taskNum,
        findedCodes,
        wrongCodes,
        findedPenaltyCodes,
        findedBonusCodes,
        startTaskTime: startTime[taskNum],
        cluesDuration,
        taskDuration,
        timeAddings,
        visibleCluesCount,
      })

      await sendTaskToOtherMembers({
        message,
        imagesForTask: images,
        visibleCluesCount,
      })
      return {
        images,
        message,
        buttons: buildTaskButtons(visibleCluesCount),
      }
    }
    if (code.length > 20) {
      return {
        message: 'Код слишком длинный. Коды не могут быть такой длинны',
      }
    }

    // Проверяем бонусный ли код
    const allFindedBonusCodes =
      findedBonusCodes ?? Array(game.tasks.length).map(() => [])
    const findedBonusCodesInTask = allFindedBonusCodes[taskNum] ?? []
    if (findedBonusCodesInTask.includes(code)) {
      return {
        message: 'Вы уже нашли этот бонусный код. Хотите еще?',
      }
    }

    // Проверяем штрафной ли код
    const allFindedPenaltyCodes =
      findedPenaltyCodes ?? Array(game.tasks.length).map(() => [])
    const findedPenaltyCodesInTask = allFindedPenaltyCodes[taskNum] ?? []
    if (findedPenaltyCodesInTask.includes(code)) {
      return {
        message: 'Вы уже нашли этот штрафной код. Хотите еще?',
      }
    }

    // Проверяем нужный ли код
    const allFindedCodes = findedCodes ?? Array(game.tasks.length).map(() => [])
    const findedCodesInTask = allFindedCodes[taskNum] ?? []
    if (findedCodesInTask.includes(code)) {
      return {
        message: 'Такой код уже найден. Введите код',
      }
    }

    // Проверяем не введен ли бонусный код
    const bonusCode = bonusCodes.find(
      (bonusCode) => bonusCode.code.toLowerCase() == code
    )

    if (bonusCode) {
      const newAllFindedBonusCodes = [...allFindedBonusCodes]
      const newFindedBonusCodesInTask = [...findedBonusCodesInTask, code]
      newAllFindedBonusCodes[taskNum] = newFindedBonusCodesInTask
      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        findedBonusCodes: newAllFindedBonusCodes,
      })

      return {
        images: game.tasks[taskNum]?.images,
        message: `КОД "${code}" - БОНУСНЫЙ!\n\n${taskText({
          game,
          taskNum: taskNum,
          findedCodes: allFindedCodes,
          findedBonusCodes: newAllFindedBonusCodes,
          findedPenaltyCodes: allFindedPenaltyCodes,
          startTaskTime: startTime[taskNum],
          cluesDuration,
          taskDuration,
          timeAddings,
          visibleCluesCount,
        })}`,
        buttons: buildTaskButtons(visibleCluesCount),
      }
    }

    // Проверяем не введен ли штрафной код
    const penaltyCode = penaltyCodes.find(
      (penaltyCode) => penaltyCode.code.toLowerCase() == code
    )

    if (penaltyCode) {
      const newAllFindedPenaltyCodes = [...allFindedPenaltyCodes]
      const newFindedPenaltyCodesInTask = [...findedPenaltyCodesInTask, code]
      newAllFindedPenaltyCodes[taskNum] = newFindedPenaltyCodesInTask
      // console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ЗАДАНИЕ ЕЩЕ НЕ ВЫПОЛНЕНО:>> ')
      // console.log('newAllFindedPenaltyCodes :>> ', newAllFindedPenaltyCodes)
      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        findedPenaltyCodes: newAllFindedPenaltyCodes,
      })

      return {
        images: game.tasks[taskNum]?.images,
        message: `КОД "${code}" - ШТРАФНОЙ!\nОписание штрафа: "${
          penaltyCode.description
        }"\n\n${taskText({
          game,
          taskNum: taskNum,
          findedCodes: allFindedCodes,
          findedBonusCodes: allFindedBonusCodes,
          findedPenaltyCodes: newAllFindedPenaltyCodes,
          startTaskTime: startTime[taskNum],
          cluesDuration,
          taskDuration,
          timeAddings,
          visibleCluesCount,
        })}`,
        buttons: buildTaskButtons(visibleCluesCount),
      }
    }

    if (
      (codes[0] !== '[time]' && codes.includes(code)) ||
      (codes[0] === '[time]' && timeToCodeStr() === code)
    ) {
      // Если код введен верно и ранее его не вводили
      const newAllFindedCodes = [...allFindedCodes]
      const newFindedCodesInTask = [...findedCodesInTask, code]
      newAllFindedCodes[taskNum] = newFindedCodesInTask

      const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
      const numOfCodesToFindLeft =
        numOfCodesToFind - newFindedCodesInTask.length
      const isTaskComplite = numOfCodesToFindLeft <= 0

      var endTimeTemp = endTime
      var startTimeTemp = startTime
      const newActiveNum = isTaskComplite ? taskNum + 1 : taskNum

      if (isTaskComplite) {
        endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)
        startTimeTemp = startTimeNextSet(startTime, taskNum, game.tasks.length)

        const usersTelegramIdsOfTeam = teamUsers
          // .filter((teamUser) => teamUser.userTelegramId !== telegramId)
          .map((teamUser) => teamUser.userTelegramId)

        // Если игра завершена
        if (newActiveNum > game.tasks.length - 1) {
          const forcedCluesTemp = resetForcedClueForTask(
            forcedClues,
            newActiveNum,
            game.tasks.length
          )

          const updates = {
            findedCodes: newAllFindedCodes,
            startTime: startTimeTemp,
            endTime: endTimeTemp,
            activeNum: newActiveNum,
          }
          if (forcedCluesTemp) updates.forcedClues = forcedCluesTemp

          await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

          const keyboard = keyboardFormer([mainMenuButton])

          return await Promise.all(
            usersTelegramIdsOfTeam.map(async (telegramId) => {
              await sendMessage({
                chat_id: telegramId,
                text: buildGameFinishedMessage(),
                keyboard,
                location,
              })
            })
          )

          // return {
          //   message:
          //     'Поздравляем Вы завершили все задания! Игра окончена. Вы можете выдвигаться на точку сбора',
          //   nextCommand: 'mainMenu',
          // }
        } else {
          //Если должен быть перерыв
          if (breakDuration > 0) {
            // console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ПЕРЕРЫВ ЕСТЬ :>> ')
            // console.log('newAllFindedCodes :>> ', newAllFindedCodes)
            await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
              findedCodes: newAllFindedCodes,
              // startTime: startTimeTemp,
              endTime: endTimeTemp,
              // activeNum: newActiveNum,
            })

            const breakText = `<b>КОД "${code}" ПРИНЯТ\nЗадание выполнено!${
              game.tasks[taskNum].postMessage
                ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>`
                : ''
            }\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
              breakDuration
            )}`}`

            return await Promise.all(
              usersTelegramIdsOfTeam.map(async (telegramId) => {
                const teamUser = getTeamUserByTelegramId(telegramId)
                const buttons = buildBreakButtons({
                  includeCaptainActions: isCaptainRole(teamUser?.role),
                })
                const keyboard = keyboardFormer(buttons)

                await sendMessage({
                  chat_id: telegramId,
                  text: breakText,
                  keyboard,
                  // images: game.tasks[taskNum].images,
                  location,
                })
              })
            )
          }
          // console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ПЕРЕРЫВА НЕТ :>> ')
          // console.log('newAllFindedCodes :>> ', newAllFindedCodes)
          const forcedCluesTemp = resetForcedClueForTask(
            forcedClues,
            newActiveNum,
            game.tasks.length
          )

          const updates = {
            findedCodes: newAllFindedCodes,
            startTime: startTimeTemp,
            endTime: endTimeTemp,
            activeNum: newActiveNum,
          }
          if (forcedCluesTemp) updates.forcedClues = forcedCluesTemp

          await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, updates)

          const keyboard = keyboardFormer(buttonRefresh)

          return await Promise.all(
            usersTelegramIdsOfTeam.map(async (telegramId) => {
              await sendMessage({
                chat_id: telegramId,
                text: taskText({
                  game,
                  taskNum: newActiveNum,
                  startTaskTime: startTimeTemp[newActiveNum],
                  cluesDuration,
                  taskDuration,
                  timeAddings,
                }),
                keyboard,
                images: game.tasks[taskNum].images,
                location,
              })
            })
          )
        }
      }

      // console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ЗАДАНИЕ ЕЩЕ НЕ ВЫПОЛНЕНО:>> ')
      // console.log('newAllFindedCodes :>> ', newAllFindedCodes)
      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        findedCodes: newAllFindedCodes,
        // startTime: startTimeTemp,
        // endTime: endTimeTemp,
        // activeNum: newActiveNum,
      })

      return {
        images: isTaskComplite ? game.tasks[newActiveNum]?.images : undefined,
        message: `КОД "${code}" ПРИНЯТ${
          !isTaskComplite
            ? `\n\n${taskText({
                game,
                taskNum: newActiveNum,
                findedCodes: isTaskComplite ? [] : newAllFindedCodes,
                findedBonusCodes: isTaskComplite ? [] : allFindedBonusCodes,
                findedPenaltyCodes: isTaskComplite ? [] : allFindedPenaltyCodes,
                startTaskTime: startTime[newActiveNum],
                cluesDuration,
                taskDuration,
                timeAddings,
                visibleCluesCount,
              })}`
            : ''
        }`,
        buttons: isTaskComplite
          ? undefined
          : buildTaskButtons(visibleCluesCount),
        nextCommand: isTaskComplite
          ? {
              // showTask: true
            }
          : undefined,
      }
    } else {
      const allWrongCodes = wrongCodes ?? Array(game.tasks.length).map(() => [])
      const newAllWrongCodes = [...allWrongCodes]
      const wrongCodesInTask = allWrongCodes[taskNum] ?? []
      const newWrongCodesInTask = [...wrongCodesInTask, code]
      newAllWrongCodes[taskNum] = newWrongCodesInTask

      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        wrongCodes: newAllWrongCodes,
        // startTime: startTimeTemp,
        // endTime: endTimeTemp,
        // activeNum: newActiveNum,
      })
      return {
        message: 'Код не верен. Введите код',
      }
    }
  }
}

export default gameProcess
