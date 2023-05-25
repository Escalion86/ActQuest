import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'

const game = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const teamsInGame = await getTeamOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId
  )

  return {
    message: `Игра "${game?.name}".${
      game?.description ? `\nОписание: "${game?.description}"` : ''
    }${
      teamsInGame
        ? `Записана команда ${teamsInGame
            .map((team) => `"${team.name}"`)
            .join(', ')}`
        : ''
    }`,
    buttons: [
      {
        cmd: { cmd: 'join_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Зарегистрироваться на игру',
        hide: teamsInGame,
      },
      {
        cmd: { cmd: 'detach_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Отписаться от игры',
        hide: !teamsInGame,
      },
      { cmd: 'menu_games', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
