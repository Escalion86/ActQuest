import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editPenaltyCodes = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]

  const { penaltyCodes } = task
  const buttons =
    !penaltyCodes || typeof penaltyCodes !== 'object'
      ? []
      : penaltyCodes.map(({ code, penalty, description }, index) => {
          return {
            text: `Код: ${code}`,
            c: {
              c: 'editPenaltyCode',
              gameId: jsonCommand.gameId,
              i: jsonCommand.i,
              j: index,
            },
          }
        })

  // if (!jsonCommand.message) {
  return {
    success: true,
    message: `Список штрафных кодов\n\n${
      penaltyCodes.length > 0
        ? penaltyCodes
            .map(
              ({ code, penalty, description }) =>
                `"${code}" - ${secondsToTimeStr(penalty)} - ${description}`
            )
            .join(',\n')
        : ''
    }`,
    buttons: [
      ...buttons,
      {
        text: '\u{2795} Добавить штрафной код',
        c: {
          c: 'addPenaltyCode',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
    ],
  }
  // }

  // await dbConnect()
  // const game = await Games.findById(jsonCommand.gameId)
  // const tasks = [...game.tasks]
  // // const task = tasks[jsonCommand.i]
  // tasks[jsonCommand.i].penaltyCodes = jsonCommand.noCodes
  //   ? []
  //   : jsonCommand.message !== ''
  //   ? jsonCommand.message.toLowerCase().split(',')
  //   : []
  // // console.log('task :>> ', task)
  // // const newTask = { ...task, title: jsonCommand.message }
  // // console.log('newTask :>> ', newTask)
  // // tasks[jsonCommand.i] = newTask

  // await Games.findByIdAndUpdate(jsonCommand.gameId, {
  //   tasks,
  // })

  // return {
  //   success: true,
  //   message: `Коды обновлены`,
  //   nextCommand: {
  //     c: 'editTask',
  //     gameId: jsonCommand.gameId,
  //     i: jsonCommand.i,
  //   },
  // }
}

export default editPenaltyCodes
