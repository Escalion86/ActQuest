import check from 'telegram/func/check'

const setBonusCodeDescription = async ({
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
      message: 'Введите описание бонусного кода (за что дается бонус?)',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editBonusCode',
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
  const bonusCodes = [...tasks[jsonCommand.i].bonusCodes]
  bonusCodes[jsonCommand.j].description = jsonCommand.message
  tasks[jsonCommand.i].bonusCodes = bonusCodes

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Описание бонусного кода обновлено`,
    nextCommand: {
      c: 'editBonusCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setBonusCodeDescription
