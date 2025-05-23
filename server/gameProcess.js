import getSecondsBetween from '@helpers/getSecondsBetween'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import keyboardFormer from 'telegram/func/keyboardFormer'
import taskText from 'telegram/func/taskText'
import sendMessage from 'telegram/sendMessage'
import secondsToTime from 'telegram/func/secondsToTime'
import padNum from 'telegram/func/padNum'
import moment from 'moment-timezone'

const timeToCodeStr = () => {
  var d = moment.tz(new Date(), 'Asia/Krasnoyarsk')
  var obj = d.toObject()
  const { minutes, hours } = obj
  return padNum(hours, 2) + padNum(minutes, 2)
}

const endTimeSet = (endTime, taskNum, gameTasksLength) => {
  const newDate = new Date()
  var endTimeTemp = endTime ? [...endTime] : undefined
  if (endTimeTemp) {
    if (endTimeTemp.length < taskNum + 1) {
      const newArray = Array(gameTasksLength).fill(undefined)
      endTimeTemp.forEach((item, index) => (newArray[index] = item))
      endTimeTemp = [...newArray]
    }
  } else {
    endTimeTemp = Array(gameTasksLength).fill(undefined)
  }
  endTimeTemp[taskNum] = newDate
  return endTimeTemp
}

const startTimeNextSet = (startTime, taskNum, gameTasksLength) => {
  // var endTimeTemp = endTime
  const newDate = new Date()
  var startTimeTemp = startTime ? [...startTime] : undefined
  if (startTimeTemp) {
    if (startTimeTemp.length < taskNum + 1) {
      const newArray = Array(gameTasksLength).fill(undefined)
      startTimeTemp.forEach((item, index) => (newArray[index] = item))
      startTimeTemp = [...newArray]
    }
  } else {
    startTimeTemp = Array(gameTasksLength).fill(undefined)
  }
  if (taskNum < gameTasksLength - 1) {
    startTimeTemp[taskNum + 1] = newDate
  }
  return startTimeTemp
}

const teamGameStart = async (gameTeamId, game, db) => {
  const gameTasksCount = game.tasks.length
  const startTime = new Array(gameTasksCount).fill(null)
  startTime[0] = new Date()
  const endTime = new Array(gameTasksCount).fill(null)
  const findedCodes = new Array(gameTasksCount).fill([])
  const wrongCodes = new Array(gameTasksCount).fill([])
  const findedPenaltyCodes = new Array(gameTasksCount).fill([])
  const findedBonusCodes = new Array(gameTasksCount).fill([])
  const photos = new Array(gameTasksCount).fill({ photos: [], checks: {} })
  await db.model('GamesTeams').findByIdAndUpdate(gameTeamId, {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    photos,
  })
}

const gameProcess = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

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
  if (!gameTeam.startTime || gameTeam.startTime.length === 0) {
    await teamGameStart(gameTeam._id, game, db)
  }

  const {
    findedCodes,
    wrongCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    activeNum,
    startTime,
    endTime,
    photos,
  } = gameTeam

  const breakDuration = game.breakDuration ?? 0
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200

  const taskNum = activeNum ?? 0

  const gameType = game?.type || 'classic'

  // return 'test'

  const buttonRefresh = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: '\u{1F504} Обновить',
    },
  ]

  const buttonSeePhotoAnswers = [
    {
      c: { seePhotoAnswers: true },
      text: '\u{1F4F7} Посмотреть фото-ответы на задание',
    },
  ]

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
        }),
      buttons: [
        buttonRefresh,
        ...(filteredPhotos.length > 0 ? [buttonSeePhotoAnswers] : []),
      ],
    }
  }

  const secondsLeftAfterStartTask = getSecondsBetween(startTime[taskNum])

  // Если больше заданий нет (все выполнены или последнее провалено)
  if (
    taskNum > game.tasks.length - 1 ||
    (taskNum === game.tasks.length - 1 &&
      secondsLeftAfterStartTask >= taskDuration)
  ) {
    return {
      message: `Поздравляем Вы завершили все задания! Игра окончена. ${
        game.finishingPlace
          ? `Вы можете выдвигаться на точку сбора: ${game.finishingPlace}`
          : ''
      }${
        game.tasks[game.tasks.length - 1].postMessage
          ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${
              game.tasks[game.tasks.length - 1].postMessage
            }</blockquote>`
          : ''
      }`,
      nextCommand: 'mainMenu',
    }
  }

  // Если задание было закончено успешно и идет перерыв
  // выдаем сообщение об остатке времени,
  // либо если перерыв окончен, то даем след задание

  console.log('breakDuration :>> ', breakDuration)
  console.log('endTime[taskNum] :>> ', endTime[taskNum])
  console.log('taskNum :>> ', taskNum)
  if (endTime[taskNum] && breakDuration > 0) {
    const secondsAfterEndTime = getSecondsBetween(endTime[taskNum])
    if (secondsAfterEndTime < breakDuration)
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>\n\n`
            : ''
        }<b>ПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
          breakDuration - secondsAfterEndTime
        )}`}`,
        buttons: buttonRefresh,
      }
    else {
      const startTimeTemp = startTimeNextSet(
        startTime,
        taskNum,
        game.tasks.length
      )

      await db.model('GamesTeams').findByIdAndUpdate(jsonCommand?.gameTeamId, {
        startTime: startTimeTemp,
        activeNum: taskNum + 1,
      })

      const message = taskText({
        game,
        taskNum: taskNum + 1,
        cluesDuration,
        taskDuration,
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
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>\n\n`
            : ''
        }<b>Время вышло\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
          taskDuration + breakDuration - secondsLeftAfterStartTask
        )}`}`,
        buttons: buttonRefresh,
      }
    }

    const startTimeTemp = startTimeNextSet(
      startTime,
      taskNum,
      game.tasks.length
    )

    await db.model('GamesTeams').findByIdAndUpdate(jsonCommand?.gameTeamId, {
      startTime: startTimeTemp,
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

  const {
    task,
    codes,
    numCodesToCompliteTask,
    images,
    penaltyCodes,
    bonusCodes,
  } = game.tasks[taskNum]

  if (gameType === 'photo') {
    // Если получаем фото-ответ на задание
    if (jsonCommand.isPhoto) {
      const existedPhotos =
        typeof photos?.length === 'number'
          ? [...photos]
          : new Array(gameTasksCount).fill({ photos: [], checks: {} })
      existedPhotos[taskNum].photos.push(jsonCommand.message)

      await db.model('GamesTeams').findByIdAndUpdate(jsonCommand?.gameTeamId, {
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
          }),
        buttons: [buttonRefresh, buttonSeePhotoAnswers],
      }
    }

    return {
      message: taskText({
        game,
        taskNum: taskNum,
        startTaskTime: startTime[taskNum],
        cluesDuration,
        taskDuration,
        photos,
      }),
      images:
        jsonCommand.seePhotoAnswers &&
        !jsonCommand.isPhoto &&
        !jsonCommand.isVideo &&
        !jsonCommand.isDocument &&
        !jsonCommand.message
          ? filteredPhotos
          : undefined,
      buttons: [
        buttonRefresh,
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
      })
      return {
        images,
        message,
        buttons: buttonRefresh,
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
      console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ЗАДАНИЕ ЕЩЕ НЕ ВЫПОЛНЕНО:>> ')
      console.log('newAllFindedBonusCodes :>> ', newAllFindedBonusCodes)
      const result = await db
        .model('GamesTeams')
        .findByIdAndUpdate(jsonCommand?.gameTeamId, {
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
        })}`,
        buttons: buttonRefresh,
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
      const result = await db
        .model('GamesTeams')
        .findByIdAndUpdate(jsonCommand?.gameTeamId, {
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
        })}`,
        buttons: buttonRefresh,
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

        const teamId = gameTeam.teamId
        const teamsUsers = await db.model('TeamsUsers').find({
          teamId,
        })

        const usersTelegramIdsOfTeam = teamsUsers.map(
          (teamUser) => teamUser.userTelegramId
        )

        // Если игра завершена
        if (newActiveNum > game.tasks.length - 1) {
          await db
            .model('GamesTeams')
            .findByIdAndUpdate(jsonCommand?.gameTeamId, {
              findedCodes: newAllFindedCodes,
              startTime: startTimeTemp,
              endTime: endTimeTemp,
              activeNum: newActiveNum,
            })

          const keyboard = keyboardFormer([mainMenuButton])

          // return await Promise.all(
          //   usersTelegramIdsOfTeam.map(async (telegramId) => {
          //     await sendMessage({
          //       chat_id: telegramId,
          //       text: `Поздравляем Вы завершили все задания! Игра окончена. ${
          //         game.finishingPlace
          //           ? `Вы можете выдвигаться на точку сбора: ${game.finishingPlace}`
          //           : ''
          //       }${
          //         game.tasks[game.tasks.length - 1].postMessage
          //           ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${
          //               game.tasks[game.tasks.length - 1].postMessage
          //             }</blockquote>`
          //           : ''
          //       }`,
          //       keyboard,
          //       location,
          //     })
          //   })
          // )
        } else {
          //Если должен быть перерыв
          if (breakDuration > 0) {
            await db
              .model('GamesTeams')
              .findByIdAndUpdate(jsonCommand?.gameTeamId, {
                findedCodes: newAllFindedCodes,
                endTime: endTimeTemp,
              })

            const keyboard = keyboardFormer(buttonRefresh)

            return {
              message: `<b>КОД "${code}" ПРИНЯТ\nЗадание выполнено!${
                game.tasks[taskNum].postMessage
                  ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>`
                  : ''
              }\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
                breakDuration
              )}`}`,
            }
            // return await Promise.all(
            //   usersTelegramIdsOfTeam.map(async (telegramId) => {
            //     await sendMessage({
            //       chat_id: telegramId,
            //       text: `<b>КОД "${code}" ПРИНЯТ\nЗадание выполнено!${
            //         game.tasks[taskNum].postMessage
            //           ? `\n\n<b>Сообщение от прошлого задания:</b>\n<blockquote>${game.tasks[taskNum].postMessage}</blockquote>`
            //           : ''
            //       }\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
            //         breakDuration
            //       )}`}`,
            //       keyboard,
            //       location,
            //     })
            //   })
            // )
          }
          await db
            .model('GamesTeams')
            .findByIdAndUpdate(jsonCommand?.gameTeamId, {
              findedCodes: newAllFindedCodes,
              startTime: startTimeTemp,
              endTime: endTimeTemp,
              activeNum: newActiveNum,
            })

          const keyboard = keyboardFormer(buttonRefresh)

          return {
            message: taskText({
              game,
              taskNum: newActiveNum,
              startTaskTime: startTimeTemp[newActiveNum],
              cluesDuration,
              taskDuration,
            }),
          }
          // return await Promise.all(
          //   usersTelegramIdsOfTeam.map(async (telegramId) => {
          //     await sendMessage({
          //       chat_id: telegramId,
          //       text: taskText({
          //         game,
          //         taskNum: newActiveNum,
          //         startTaskTime: startTimeTemp[newActiveNum],
          //         cluesDuration,
          //         taskDuration,
          //       }),
          //       keyboard,
          //       images: game.tasks[taskNum].images,
          //       location,
          //     })
          //   })
          // )
        }
      }

      const result = await db
        .model('GamesTeams')
        .findByIdAndUpdate(jsonCommand?.gameTeamId, {
          findedCodes: newAllFindedCodes,
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
              })}`
            : ''
        }`,
        buttons: isTaskComplite ? undefined : buttonRefresh,
        nextCommand: isTaskComplite ? {} : undefined,
      }
    } else {
      const allWrongCodes = wrongCodes ?? Array(game.tasks.length).map(() => [])
      const newAllWrongCodes = [...allWrongCodes]
      const wrongCodesInTask = allWrongCodes[taskNum] ?? []
      const newWrongCodesInTask = [...wrongCodesInTask, code]
      newAllWrongCodes[taskNum] = newWrongCodesInTask

      const result = await db
        .model('GamesTeams')
        .findByIdAndUpdate(jsonCommand?.gameTeamId, {
          wrongCodes: newAllWrongCodes,
        })
      return {
        message: 'Код не верен. Введите код',
      }
    }
  }
}

export default gameProcess
