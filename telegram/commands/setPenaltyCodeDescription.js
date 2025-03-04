import check from 'telegram/func/check'

const setPenaltyCodeDescription = async ({
  telegramId,
  jsonCommand,
  location,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите описание штрафного кода (за что дается штраф?)',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editPenaltyCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
      ],
    }
  }
  const game = await db.model('Games').findById(jsonCommand.gameId)
  const tasks = game.tasks
  const penaltyCodes = [...tasks[jsonCommand.i].penaltyCodes]
  penaltyCodes[jsonCommand.j].description = jsonCommand.message
  tasks[jsonCommand.i].penaltyCodes = penaltyCodes

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Описание штрафного кода обновлено`,
    nextCommand: {
      c: 'editPenaltyCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setPenaltyCodeDescription
