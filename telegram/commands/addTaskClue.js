import check from 'telegram/func/check'
import Games from '@models/Games'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editTaskClues', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания подсказки',
})

const array = [
  {
    prop: 'clue',
    message: 'Введите текст подсказки',
    answerMessage: (answer) =>
      `Подсказка <blockquote>${answer}</blockquote> введена`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  // {
  //   prop: 'penalty',
  //   message: 'Введите штраф в секундах. Число должно быть больше нуля',
  //   checkAnswer: (answer) => {
  //     const answerNum = Number(answer)
  //     return answerNum == answer && answerNum > 0
  //   },
  //   errorMessage: (answer) => `Штраф должен быть в секундах и больше нуля!`,
  //   answerMessage: (answer) =>
  //     `Задан штраф по времени "${secondsToTimeStr(answer)}"`,
  //   buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  // },
  // {
  //   prop: 'description',
  //   message: 'Введите описание штрафного кода (за что выдан код?)',
  //   answerMessage: (answer) => `Задано описание штрафного кода "${answer}"`,
  //   buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  // },
]

const addTaskClue = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newClue = {
        clue: result.clue,
        images: [],
      }

      const game = await Games.findById(jsonCommand.gameId)
      game.tasks[jsonCommand.i].clues.push(newClue)

      await Games.findByIdAndUpdate(jsonCommand.gameId, {
        tasks: game.tasks,
      })

      return {
        success: true,
        message: `Подсказка создана`,
        nextCommand: {
          c: 'editTaskClues',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      }
    },
  })
}

export default addTaskClue
