import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameActive = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите активацию игры ${formatGameName(
        game
      )}\n\nВНИМАНИЕ: Это приведет к удалению результатов текущей игры, однако запись на игру команд останется без изменений`,
      buttons: [
        {
          text: '\u{26A1} Активировать игру',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    status: 'active',
    result: null,
    dateStartFact: null,
    dateEndFact: null,
  })

  return {
    message: `Игра ${formatGameName(game)} активирована.`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  }
}

export default gameActive
