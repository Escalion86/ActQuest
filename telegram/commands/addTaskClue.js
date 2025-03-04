import check from 'telegram/func/check'
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
]

const addTaskClue = async ({ telegramId, jsonCommand, location, db }) => {
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

      const game = await db.model('Games').findById(jsonCommand.gameId)
      game.tasks[jsonCommand.i].clues.push(newClue)

      await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
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
