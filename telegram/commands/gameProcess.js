import getMinutesBetween from '@helpers/getMinutesBetween'
import getNoun from '@helpers/getNoun'
import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import TeamsUsers from '@models/TeamsUsers'
// import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import keyboardFormer from 'telegram/func/keyboardFormer'
import taskText from 'telegram/func/taskText'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'

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

  const { findedCodes, activeNum, startTime, endTime } = gameTeam

  const taskNum = activeNum ?? 0

  // Если больше заданий нет (все выолнены)
  if (taskNum > game.tasks.length - 1) {
    return {
      message: 'Поздравляем Вы завершили все задания!',
      nextCommand: 'mainMenu',
    }
  }

  // Проверяем не вышло ли время
  if (getSecondsBetween(startTime[activeNum]) > CLUE_DURATION_SEC * 3) {
    // const endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)

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
    return {
      message: '<b>Время вышло</b>',
      nextCommand: {},
    }
  }

  const buttonRefresh = [
    {
      c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
      text: '\u{1F504} Обновить',
    },
  ]

  const { task, codes, numCodesToCompliteTask, images } = game.tasks[taskNum]

  const code = jsonCommand.message
  if (!code) {
    // return {
    //   message: 'Введите код',
    // }
    // const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
    // const newActiveTaskNum = gameTeam?.activeNum ? gameTeam.activeNum + 1 : 1
    // await dbConnect()
    // await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
    //   activeNum: newActiveTaskNum,
    // })
    // const game = await getGame(gameTeam.gameId)
    // if (game.success === false) return game

    // const taskNum = gameTeam?.activeNum ?? 0

    return {
      images,
      message: taskText({
        tasks: game.tasks,
        taskNum,
        findedCodes,
        startTaskTime: startTime[taskNum],
      }),
      buttons: buttonRefresh,
      // nextCommand: { showTask: false },
    }
  }

  const allFindedCodes = findedCodes ?? Array(game.tasks.length).map(() => [])
  const findedCodesInTask = allFindedCodes[taskNum] ?? []

  if (findedCodesInTask.includes(code)) {
    return {
      message: 'Такой код уже найден. Введите код',
    }
  }

  if (codes.includes(code)) {
    // Если код введен верно и ранее его не вводили
    const newAllFindedCodes = [...allFindedCodes]
    const newFindedCodesInTask = [...findedCodesInTask, code]
    newAllFindedCodes[taskNum] = newFindedCodesInTask
    const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
    console.log('numOfCodesToFind :>> ', numOfCodesToFind)
    const numOfCodesToFindLeft = numOfCodesToFind - newFindedCodesInTask.length
    const isTaskComplite = numOfCodesToFindLeft <= 0

    var endTimeTemp = endTime
    var startTimeTemp = startTime

    if (isTaskComplite) {
      // const newDate = new Date()
      // if (endTimeTemp) {
      //   if (endTimeTemp.length < taskNum + 1) {
      //     const newArray = Array(game.tasks.length).fill(undefined)
      //     endTimeTemp.forEach((item, index) => (newArray[index] = item))
      //     endTimeTemp = [...newArray]
      //   }
      // } else {
      //   endTimeTemp = Array(game.tasks.length).fill(undefined)
      // }
      // endTimeTemp[taskNum] = newDate

      endTimeTemp = endTimeSet(endTime, taskNum, game.tasks.length)

      startTimeTemp = startTimeNextSet(startTime, taskNum, game.tasks.length)
      // if (startTimeTemp) {
      //   if (startTimeTemp.length < taskNum + 1) {
      //     const newArray = Array(game.tasks.length).fill(undefined)
      //     startTimeTemp.forEach((item, index) => (newArray[index] = item))
      //     startTimeTemp = [...newArray]
      //   }
      // } else {
      //   startTimeTemp = Array(game.tasks.length).fill(undefined)
      // }
      // if (taskNum < game.tasks.length - 1) {
      //   startTimeTemp[taskNum + 1] = newDate
      // }
    }

    const newActiveNum = isTaskComplite ? taskNum + 1 : taskNum

    await dbConnect()
    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      findedCodes: newAllFindedCodes,
      startTime: startTimeTemp,
      endTime: endTimeTemp,
      activeNum: newActiveNum,
    })

    if (isTaskComplite) {
      const teamId = gameTeam.teamId

      const teamsUsers = await TeamsUsers.find({
        teamId,
      })

      const usersTelegramIdsOfTeam = teamsUsers
        .filter((teamUser) => teamUser.userTelegramId !== telegramId)
        .map((teamUser) => teamUser.userTelegramId)

      // Если игра завершена
      if (newActiveNum > game.tasks.length - 1) {
        const keyboard = keyboardFormer([mainMenuButton])

        await Promise.all(
          usersTelegramIdsOfTeam.map(async (telegramId) => {
            await sendMessage({
              chat_id: telegramId,
              text: 'Поздравляем Вы завершили все задания! Игра окончена. Вы можете выдвигаться на точку сбора',
              keyboard,
            })
          })
        )

        return {
          message:
            'Поздравляем Вы завершили все задания! Игра окончена. Вы можете выдвигаться на точку сбора',
          nextCommand: 'mainMenu',
        }
      } else {
        const keyboard = keyboardFormer(buttonRefresh)

        await Promise.all(
          usersTelegramIdsOfTeam.map(async (telegramId) => {
            await sendMessage({
              chat_id: telegramId,
              text: taskText({ tasks: game.tasks, taskNum: newActiveNum }),
              keyboard,
              images: game.tasks[taskNum].images,
            })
          })
        )
      }
    }

    return {
      images: isTaskComplite ? game.tasks[newActiveNum]?.images : undefined,
      message: `КОД "${code}" ПРИНЯТ${
        !isTaskComplite
          ? `\nОсталось найти ${getNoun(
              numOfCodesToFindLeft,
              'код',
              'кода',
              'кодов'
            )}\n\n${taskText({
              tasks: game.tasks,
              taskNum: newActiveNum,
              findedCodes: isTaskComplite ? [] : newAllFindedCodes,
              startTaskTime: startTime[newActiveNum],
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
