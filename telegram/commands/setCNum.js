import check from 'telegram/func/check'

const setCNum = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите цифру количества кодов необходимого для выполнения задания',
      buttons: [
        {
          text: 'Все',
          c: {
            noCNum: true,
          },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const game = await db.model('Games').findById(jsonCommand.gameId)
  const tasks = [...game.tasks]

  tasks[jsonCommand.i].numCodesToCompliteTask = jsonCommand.noCNum
    ? null
    : jsonCommand.message !== ''
    ? Number(jsonCommand.message.split(','))
    : null

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Количество кодов необходимое для выполнения задания обновлено`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setCNum
