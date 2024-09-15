import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameType = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.type) {
    return {
      success: true,
      message:
        'Выберите тип игры:\n\u{1F697} Классика - в качестве ответа на задание должен быть какой-либо текст или набор цифр. Побеждает та команда, которая выполнит задания быстрее всех с учетом бонусов и штрафов по времени\n\u{1F4F7} Фотоквест - в качестве ответа на задание должно быть изображение. За каждое выполненное, а также дополнительные задания начисляются баллы. Побеждает команда набравшая больше всех баллов',
      buttons: [
        {
          c: { type: 'classic' },
          text: '\u{1F697} Классика',
        },
        {
          c: { type: 'photo' },
          text: '\u{1F4F7} Фотоквест',
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    type: jsonCommand.type,
  })

  return {
    success: true,
    message: `Установлен тип игры "${
      jsonCommand.type === 'photo'
        ? '\u{1F4F7} Фотоквест'
        : '\u{1F697} Классика'
    }"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameType
