import check from 'telegram/func/check'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editPenaltyCodes', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания штрафного кода',
})

const array = [
  {
    prop: 'code',
    message: 'Введите штрафной код',
    answerMessage: (answer) => `Штрафной код "${answer}"`,
    answerConverter: (answer) => answer.trim().toLowerCase(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'penalty',
    message: 'Введите штраф в секундах. Число должно быть больше нуля',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Штраф должен быть в секундах и больше нуля!`,
    answerMessage: (answer) =>
      `Задан штраф по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'description',
    message: 'Введите описание штрафного кода (за что выдан код?)',
    answerMessage: (answer) => `Задано описание штрафного кода "${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addPenaltyCode = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newPenaltyCode = {
        penalty: result.penalty,
        code: result.code,
        description: result.description,
      }

      // Если все переменные на месте, то создаем команду
      const game = await db.model('Games').findById(jsonCommand.gameId)
      game.tasks[jsonCommand.i].penaltyCodes.push(newPenaltyCode)

      await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
        tasks: game.tasks,
      })

      return {
        success: true,
        message: `Штрафной код "${result.code}" создан`,
        nextCommand: {
          c: 'editPenaltyCodes',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      }
    },
  })
}

export default addPenaltyCode
