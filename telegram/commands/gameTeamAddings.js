import secondsToTimeStr from '@helpers/secondsToTimeStr'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamAddings = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  const page = jsonCommand?.page ?? 1
  const buttons = gameTeam?.timeAddings
    ? buttonListConstructor(
        gameTeam.timeAddings,
        page,
        ({ id, name, time }, number) => {
          return {
            text: `${number}. \u{1F5D1} ${
              time < 0 ? `\u{1F7E2}` : `\u{1F534}`
            } ${name}`,
            c: {
              c: `delGameTeamAdding${time < 0 ? 'Bonus' : 'Penalty'}`,
              gameTeamId: jsonCommand.gameTeamId,
              i: number - 1,
            },
          }
        }
      )
    : []

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
      team?.name
    }"</b>\n\n<b>Текущие бонусы/штрафы:</b>${
      gameTeam?.timeAddings && gameTeam.timeAddings.length > 0
        ? gameTeam.timeAddings.map(({ name, time }) => {
            return `\n${
              time < 0 ? `\u{1F7E2}` : `\u{1F534}`
            } ${secondsToTimeStr(Math.abs(time), true)} - ${name}`
          })
        : ' отсутвуют'
    }`,
    buttons: [
      ...buttons,
      [
        {
          text: '\u{2795} \u{1F7E2} Бонус',
          c: {
            c: 'addGameTeamAddingBonus',
            gameTeamId: jsonCommand.gameTeamId,
          },
        },
        {
          text: '\u{2795} \u{1F534} Штраф',
          c: {
            c: 'addGameTeamAddingPenalty',
            gameTeamId: jsonCommand.gameTeamId,
          },
        },
      ],
      {
        c: { c: 'gameTeamAdmin', gameTeamId: jsonCommand.gameTeamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamAddings
