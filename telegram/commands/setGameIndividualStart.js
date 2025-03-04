import check from 'telegram/func/check'

const setGameIndividualStart = async ({
  telegramId,
  jsonCommand,
  location,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (typeof jsonCommand.iStart !== 'boolean') {
    return {
      success: true,
      message: 'Выберите режим выдачи заданий при старте',
      buttons: [
        {
          text: 'Индивидуальный',
          c: { iStart: true },
        },
        {
          text: 'Одновременно со всеми',
          c: { iStart: false },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    individualStart: jsonCommand.iStart,
  })

  return {
    success: true,
    message: `Установлен режим выдачи заданий на "${
      jsonCommand.iStart ? 'Индивидуальный' : 'Одновременно со всеми'
    }"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameIndividualStart
