import check from 'telegram/func/check'
import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editBonusCodes', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания бонусного кода',
})

const array = [
  {
    prop: 'code',
    message: 'Введите бонусный код',
    answerMessage: (answer) => `Бонусный код "${answer}"`,
    answerConverter: (answer) => answer.trim().toLowerCase(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'bonus',
    message: 'Введите бонус в секундах. Число должно быть больше нуля',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Бонус должен быть в секундах и больше нуля!`,
    answerMessage: (answer) =>
      `Задан бонус по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'description',
    message: 'Введите описание бонусного кода (за что выдан код?)',
    answerMessage: (answer) => `Задано описание бонусного кода "${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addBonusCode = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newBonusCode = {
        bonus: result.bonus,
        code: result.code,
        description: result.description,
      }

      // Если все переменные на месте, то создаем команду
      const game = await Games.findById(jsonCommand.gameId)
      game.tasks[jsonCommand.i].bonusCodes.push(newBonusCode)

      await Games.findByIdAndUpdate(jsonCommand.gameId, {
        tasks: game.tasks,
      })

      return {
        success: true,
        message: `Бонусный код "${result.code}" создан`,
        nextCommand: {
          c: 'editBonusCodes',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      }
    },
  })

  // // Если это запрос (команда), то отправляем текст пользователю
  // if (!jsonCommand.message) {
  //   for (let i = 0; i < array.length; i++) {
  //     const data = array[i]
  //     if (jsonCommand[data.prop] === undefined) {
  //       return {
  //         success: true,
  //         message: data.message,
  //         buttons: data.buttons(jsonCommand),
  //         // nextCommand: `/menuTeams`,
  //       }
  //     }
  //   }
  // }

  // // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  // for (let i = 0; i < array.length; i++) {
  //   const data = array[i]
  //   if (jsonCommand[data.prop] === undefined) {
  //     const value =
  //       typeof array[i].answerConverter === 'function'
  //         ? array[i].answerConverter(jsonCommand.message)
  //         : jsonCommand.message

  //     if (i < array.length - 1) {
  //       return {
  //         success: true,
  //         message: array[i].answerMessage(value),
  //         // buttons: data.buttons(jsonCommand),
  //         nextCommand: { [data.prop]: value },
  //       }
  //     } else {
  //       jsonCommand[data.prop] = value
  //     }
  //   }
  // }

  // const newBonusCode = {
  //   bonus: jsonCommand.bonus,
  //   code: jsonCommand.code,
  //   description: jsonCommand.description,
  // }

  // // Если все переменные на месте, то создаем команду
  // // await dbConnect() // TODO: Нужно ли это?
  // const game = await Games.findById(jsonCommand.gameId)
  // game.tasks[jsonCommand.i].bonusCodes.push(newBonusCode)

  // await Games.findByIdAndUpdate(jsonCommand.gameId, {
  //   tasks: game.tasks,
  // })

  // return {
  //   success: true,
  //   message: `Бонусный код "${jsonCommand.code}" создан`,
  //   nextCommand: {
  //     c: 'editBonusCodes',
  //     gameId: jsonCommand.gameId,
  //     i: jsonCommand.i,
  //   },
  // }
}

export default addBonusCode
