import { getNounCodes } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

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
    buttons: (jsonCommand) => [
      [
        {
          c: { delPenalty: true },
          text: '\u{1F4A3} Удалить штраф',
        },
      ],
      [cancelButton(jsonCommand)],
    ],
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

const setManyCodesPenalty = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (jsonCommand.delPenalty) {
    const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
      manyCodesPenalty: [0, 0],
    })
    return {
      success: true,
      message: `Штраф за введение большого кол-ва неверных кодов удален`,
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async ({ count, penalty }) => {
      const manyCodesPenalty = [count, penalty]
      const game = await db
        .model('Games')
        .findByIdAndUpdate(jsonCommand.gameId, {
          manyCodesPenalty,
        })
      return {
        success: true,
        message: `Штраф за введение большого кол-ва неверных кодов обновлен на "за ${getNounCodes(
          count
        )} кодов штраф ${secondsToTimeStr(penalty)}"`,
        nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
      }
    },
  })

  // const manyCodesPenalty = [
  //   jsonCommand.count,
  //   jsonCommand.penalty,
  // ]

  // const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
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
