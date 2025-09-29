import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const setCaptainForceClue = async ({ jsonCommand, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (typeof jsonCommand.allow !== 'boolean') {
    const game = await getGame(jsonCommand.gameId, db)
    if (game.success === false) return game

    const allowCaptainForceClue = game.allowCaptainForceClue !== false

    return {
      success: true,
      message: `Сейчас капитаны ${
        allowCaptainForceClue ? 'могут' : 'не могут'
      } получить подсказку досрочно. Выберите новое значение.`,
      buttons: [
        { text: '\u{2705} Разрешить', c: { allow: true } },
        { text: '\u{1F6AB} Запретить', c: { allow: false } },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'cluesSettings', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    allowCaptainForceClue: jsonCommand.allow,
  })

  return {
    success: true,
    message: `Досрочная подсказка капитанам ${
      jsonCommand.allow ? 'разрешена' : 'запрещена'
    }.`,
    nextCommand: { c: 'cluesSettings', gameId: jsonCommand.gameId },
  }
}

export default setCaptainForceClue
