import getNoun from '@helpers/getNoun'
import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import keyboardFormer from 'telegram/func/keyboardFormer'
import taskText from 'telegram/func/taskText'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'
import secondsToTime from 'telegram/func/secondsToTime'

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

const teamGameStart = async (gameTeamId, game) => {
  const gameTasksCount = game.tasks.length
  const startTime = new Array(gameTasksCount).fill(null)
  startTime[0] = new Date()
  const endTime = new Array(gameTasksCount).fill(null)
  const findedCodes = new Array(gameTasksCount).fill([])
  await dbConnect()
  await GamesTeams.findByIdAndUpdate(gameTeamId, {
    startTime,
    endTime,
    activeNum: 0,
    findedCodes,
  })
}

const gameProcess = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  // if (jsonCommand.showTask) {
  //   const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  //   // const newActiveTaskNum = gameTeam?.activeNum ? gameTeam.activeNum + 1 : 1
  //   // await dbConnect()
  //   // await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
  //   //   activeNum: newActiveTaskNum,
  //   // })
  //   const game = await getGame(gameTeam.gameId)
  //   if (game.success === false) return game

  //   const taskNum = gameTeam?.activeNum ?? 0

  //   return {
  //     message: taskText({
  //       tasks: game.tasks,
  //       taskNum,
  //       findedCodes: gameTeam?.findedCodes,
  //     }),
  //     nextCommand: { showTask: false },
  //   }
  // }

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
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
  if (!gameTeam.startTime && gameTeam.startTime.length === 0) {
    console.log('gameTeam :>> ', gameTeam)
    console.log('СТАРТУЕТ КОМАНДА :>> ')
    await teamGameStart(gameTeam._id, game)
  }

  const {
    findedCodes,
    findedPenaltyCodes,
    findedBonusCodes,
    activeNum,
    startTime,
    endTime,
  } = gameTeam

  const taskNum = activeNum ?? 0

  // Если больше заданий нет (все выолнены)
  if (taskNum > game.tasks.length - 1) {
    return {
      message:
        'Поздравляем Вы завершили все задания! Вы можете выдвигаться на точку сбора',
      nextCommand: 'mainMenu',
    }
  }

  const buttonRefresh = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: '\u{1F504} Обновить',
    },
  ]

  const breakDuration = game.breakDuration ?? 0
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200

  // Если задание было закончено успешно и идет перерыв
  // выдаем сообщение об остатке времени,
  // либо если перерыв окончен, то даем след задание

  if (endTime[activeNum] && breakDuration > 0) {
    const secondsAfterEndTime = getSecondsBetween(endTime[activeNum])
    if (secondsAfterEndTime < breakDuration)
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `Сообщение от прошлого задания:\n"${game.tasks[activeNum].postMessage}"\n\n`
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

      await dbConnect()
      await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
        // findedCodes: newAllFindedCodes,
        startTime: startTimeTemp,
        // endTime: endTimeTemp,
        activeNum: activeNum + 1,
      })

      const message = taskText({
        tasks: game.tasks,
        taskNum: activeNum + 1,
        // findedCodes,
        // startTaskTime: startTime[activeNum + 1],
        cluesDuration,
        taskDuration,
      })
      return {
        images: game.tasks[activeNum + 1].images,
        message,
        buttons: buttonRefresh,
      }
    }
  }

  // Если задание небыло закончено и идет перерыв
  // выдаем сообщение об остатке времени,
  // либо если перерыв окончен, то даем след задание

  // Проверяем не вышло ли время
  const secondsLeftAfterStartTask = getSecondsBetween(startTime[activeNum])
  if (secondsLeftAfterStartTask > taskDuration) {
    // Проверяем есть ли перерыв и если есть то закончился ли
    if (
      !endTime[activeNum] &&
      breakDuration > 0 &&
      secondsLeftAfterStartTask < taskDuration + breakDuration
    ) {
      // ПЕРЕРЫВ
      // const endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)
      // await dbConnect()
      // await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      //   // findedCodes: newAllFindedCodes,
      //   // startTime: startTimeTemp,
      //   endTime: endTimeTemp,
      //   // activeNum: activeNum + 1,
      // })
      return {
        message: `${
          game.tasks[taskNum].postMessage
            ? `Сообщение от прошлого задания:\n"${game.tasks[activeNum].postMessage}"\n\n`
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

    await dbConnect()
    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      // findedCodes: newAllFindedCodes,
      startTime: startTimeTemp,
      // endTime: endTimeTemp,
      activeNum: activeNum + 1,
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

  const code = jsonCommand.message
    ? jsonCommand.message.toLowerCase()
    : undefined
  if (!code) {
    console.log('!code => startTime :>> ', startTime)
    console.log('taskNum :>> ', taskNum)
    const message = taskText({
      tasks: game.tasks,
      taskNum,
      findedCodes,
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
    await dbConnect()
    const result = await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      findedBonusCodes: newAllFindedBonusCodes,
    })

    return {
      images: game.tasks[taskNum]?.images,
      message: `КОД "${code}" - БОНУСНЫЙ!\n\n${taskText({
        tasks: game.tasks,
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
    console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ЗАДАНИЕ ЕЩЕ НЕ ВЫПОЛНЕНО:>> ')
    console.log('newAllFindedPenaltyCodes :>> ', newAllFindedPenaltyCodes)
    await dbConnect()
    const result = await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      findedPenaltyCodes: newAllFindedPenaltyCodes,
    })

    return {
      images: game.tasks[taskNum]?.images,
      message: `КОД "${code}" - ШТРАФНОЙ!\nОписание штрафа: "${
        penaltyCode.description
      }"\n\n${taskText({
        tasks: game.tasks,
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

  if (codes.includes(code)) {
    // Если код введен верно и ранее его не вводили
    const newAllFindedCodes = [...allFindedCodes]
    const newFindedCodesInTask = [...findedCodesInTask, code]
    newAllFindedCodes[taskNum] = newFindedCodesInTask

    const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
    const numOfCodesToFindLeft = numOfCodesToFind - newFindedCodesInTask.length
    const isTaskComplite = numOfCodesToFindLeft <= 0

    var endTimeTemp = endTime
    var startTimeTemp = startTime
    const newActiveNum = isTaskComplite ? taskNum + 1 : taskNum

    if (isTaskComplite) {
      endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)
      startTimeTemp = startTimeNextSet(startTime, taskNum, game.tasks.length)

      const teamId = gameTeam.teamId
      const teamsUsers = await TeamsUsers.find({
        teamId,
      })

      const usersTelegramIdsOfTeam = teamsUsers
        // .filter((teamUser) => teamUser.userTelegramId !== telegramId)
        .map((teamUser) => teamUser.userTelegramId)

      // Если игра завершена
      if (newActiveNum > game.tasks.length - 1) {
        await dbConnect()
        await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
          findedCodes: newAllFindedCodes,
          startTime: startTimeTemp,
          endTime: endTimeTemp,
          activeNum: newActiveNum,
        })

        const keyboard = keyboardFormer([mainMenuButton])

        return await Promise.all(
          usersTelegramIdsOfTeam.map(async (telegramId) => {
            await sendMessage({
              chat_id: telegramId,
              text: 'Поздравляем Вы завершили все задания! Игра окончена. Вы можете выдвигаться на точку сбора',
              keyboard,
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
          console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ПЕРЕРЫВ ЕСТЬ :>> ')
          console.log('newAllFindedCodes :>> ', newAllFindedCodes)
          await dbConnect()
          await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
            findedCodes: newAllFindedCodes,
            // startTime: startTimeTemp,
            endTime: endTimeTemp,
            // activeNum: newActiveNum,
          })

          const keyboard = keyboardFormer(buttonRefresh)

          return await Promise.all(
            usersTelegramIdsOfTeam.map(async (telegramId) => {
              await sendMessage({
                chat_id: telegramId,
                text: `<b>КОД "${code}" ПРИНЯТ\nЗадание выполнено!${
                  game.tasks[taskNum].postMessage
                    ? `\n\nСообщение от прошлого задания:\n"${game.tasks[taskNum].postMessage}"`
                    : ''
                }\n\nПЕРЕРЫВ</b>${`\n\n<b>Время до окончания перерыва</b>: ${secondsToTime(
                  breakDuration
                )}`}`,
                keyboard,
                // images: game.tasks[taskNum].images,
              })
            })
          )
        }
        console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ПЕРЕРЫВА НЕТ :>> ')
        console.log('newAllFindedCodes :>> ', newAllFindedCodes)
        await dbConnect()
        await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
          findedCodes: newAllFindedCodes,
          startTime: startTimeTemp,
          endTime: endTimeTemp,
          activeNum: newActiveNum,
        })

        const keyboard = keyboardFormer(buttonRefresh)

        return await Promise.all(
          usersTelegramIdsOfTeam.map(async (telegramId) => {
            await sendMessage({
              chat_id: telegramId,
              text: taskText({
                tasks: game.tasks,
                taskNum: newActiveNum,
                startTaskTime: startTimeTemp[newActiveNum],
                cluesDuration,
                taskDuration,
              }),
              keyboard,
              images: game.tasks[taskNum].images,
            })
          })
        )
      }
    }

    console.log('ОБНОВЛЯЕМ КОДЫ ЕСЛИ ЗАДАНИЕ ЕЩЕ НЕ ВЫПОЛНЕНО:>> ')
    console.log('newAllFindedCodes :>> ', newAllFindedCodes)
    await dbConnect()
    const result = await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
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
              tasks: game.tasks,
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
      nextCommand: isTaskComplite
        ? {
            // showTask: true
          }
        : undefined,
    }
  } else {
    return {
      message: 'Код не верен. Введите код',
    }
  }
}

export default gameProcess
