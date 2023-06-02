import getNoun from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
// import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import taskText from 'telegram/func/taskText'

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

  const { findedCodes, activeNum, startTime, endTime } = gameTeam

  const taskNum = activeNum ?? 0

  if (taskNum > game.tasks.length) {
    return {
      message: 'Поздравляем Вы завершили все задания!\n\n',
      // nextCommand: { showTask: false },
    }
  }

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
      }),
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
    const numOfCodesToFindLeft = numOfCodesToFind - newFindedCodesInTask.length
    const isTaskComplite = numOfCodesToFindLeft <= 0

    var endTimeTemp = endTime
    var startTimeTemp = startTime

    if (isTaskComplite) {
      const newDate = new Date()
      if (endTimeTemp) {
        if (endTimeTemp.length < taskNum + 1) {
          const newArray = Array(game.tasks.length).fill(undefined)
          endTimeTemp.forEach((item, index) => (newArray[index] = item))
          endTimeTemp = [...newArray]
        }
      } else {
        endTimeTemp = Array(game.tasks.length).fill(undefined)
      }
      endTimeTemp[taskNum] = newDate

      if (startTimeTemp) {
        if (startTimeTemp.length < taskNum + 1) {
          const newArray = Array(game.tasks.length).fill(undefined)
          startTimeTemp.forEach((item, index) => (newArray[index] = item))
          startTimeTemp = [...newArray]
        }
      } else {
        startTimeTemp = Array(game.tasks.length).fill(undefined)
      }
      if (taskNum < game.tasks.length - 1) {
        startTimeTemp[taskNum + 1] = newDate
      }
    }

    const newActiveNum = isTaskComplite ? taskNum + 1 : taskNum

    await dbConnect()
    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      findedCodes: newAllFindedCodes,
      startTime: startTimeTemp,
      endTime: endTimeTemp,
      activeNum: newActiveNum,
    })

    return {
      images: isTaskComplite ? game.tasks[newActiveNum]?.images : undefined,
      message: `КОД "${code}" ПРИНЯТ${
        numOfCodesToFindLeft > 0
          ? `\nОсталось найти ${getNoun(
              numOfCodesToFindLeft,
              'код',
              'кода',
              'кодов'
            )}\n\n${taskText({
              tasks: game.tasks,
              taskNum: newActiveNum,
              findedCodes: isTaskComplite ? [] : newAllFindedCodes,
            })}`
          : ''
      }`,
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
