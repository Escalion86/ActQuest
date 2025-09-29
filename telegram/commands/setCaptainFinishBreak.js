import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const setCaptainFinishBreak = async ({ jsonCommand, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (typeof jsonCommand.allow !== 'boolean') {
    const game = await getGame(jsonCommand.gameId, db)
    if (game.success === false) return game

    const allowCaptainFinishBreak = game.allowCaptainFinishBreak !== false

    return {
      success: true,
      message: `Сейчас капитаны ${
        allowCaptainFinishBreak ? 'могут' : 'не могут'
      } завершать перерыв досрочно. Выберите новое значение.`,
      buttons: [
        { text: '\u{2705} Разрешить', c: { allow: true } },
        { text: '\u{1F6AB} Запретить', c: { allow: false } },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    allowCaptainFinishBreak: jsonCommand.allow,
  })

  return {
    success: true,
    message: `Досрочное завершение перерыва капитанам ${
      jsonCommand.allow ? 'разрешено' : 'запрещено'
    }.`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setCaptainFinishBreak
