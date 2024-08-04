import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'
import arrayOfCommands from 'telegram/func/arrayOfCommands'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editGame', gameId: jsonCommand.gameId },
  text: '\u{1F6AB} Отмена создания штрафа',
})

const array = [
  {
    prop: 'count',
    message:
      'Введите кол-во неверных кодов в одном задании за которое будет назначаться штраф',
    answerMessage: (answer) => `Кол-во кодов: ${answer}`,
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) =>
      `Количество неверных кодов должно быть в числовом формате`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'penalty',
    message:
      'Введите штраф в секундах за большое количество неверно введенных кодов',
    answerMessage: (answer) =>
      `Задан штраф по времени "${secondsToTimeStr(answer)}"`,
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Штраф должен быть в числовом формате с секундах`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const setManyCodesPenalty = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

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

  // for (let i = 0; i < array.length; i++) {
  //   const data = array[i]
  //   if (jsonCommand[data.prop] === undefined) {
  //     if (
  //       array[i].checkAnswer !== undefined &&
  //       !array[i].checkAnswer(jsonCommand.message)
  //     ) {
  //       return {
  //         success: false,
  //         message: array[i].errorMessage(jsonCommand.message),
  //         // buttons: data.buttons(props),
  //         nextCommand: jsonCommand,
  //         // `/createGame` + propsToStr(props),
  //       }
  //     }

  //     const value =
  //       typeof array[i].answerConverter === 'function'
  //         ? array[i].answerConverter(jsonCommand.message)
  //         : jsonCommand.message

  //     if (i < array.length - 1) {
  //       return {
  //         success: true,
  //         message: array[i].answerMessage(jsonCommand.message),
  //         // buttons: data.buttons(props),
  //         nextCommand: { [data.prop]: value },
  //         // `/createGame` + propsToStr(props),
  //       }
  //     } else {
  //       jsonCommand[data.prop] = value
  //     }
  //   }
  // }

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async ({ count, penalty }) => {
      const manyCodesPenalty = [count, penalty]
      const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
        manyCodesPenalty,
      })
      return {
        success: true,
        message: `Штраф за введение большого кол-ва неверных кодов обновлен на "за ${count} кодов штраф ${secondsToTimeStr(
          penalty
        )}"`,
        nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
      }
    },
  })

  // const manyCodesPenalty = [
  //   jsonCommand.count,
  //   jsonCommand.penalty,
  // ]

  // const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
  //   manyCodesPenalty,
  // })

  // return {
  //   success: true,
  //   message: `Штраф за введение большого кол-ва неверных кодов обновлен на "${secondsToTimeStr(
  //     value
  //   )}"`,
  //   nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  // }
}

export default setManyCodesPenalty
