import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamsCheckPhotos = async ({ telegramId, jsonCommand, user }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const page = jsonCommand?.page ?? 1
  const buttons =
    gameTeam?.photos?.length > 0
      ? buttonListConstructor(
          gameTeam.photos,
          page,
          ({ photos, checks }, number) => {
            if (!photos?.length === 0)
              return {
                text: `${number}. "${game.tasks[number - 1].title}" - 0 фото`,
                c: {
                  c: 'gameTeamCheckPhotosInTask',
                  gameTeamId: jsonCommand?.gameTeamId,
                  i: number - 1,
                },
              }
            return {
              text: `${number}. "${game.tasks[number - 1].title}" - ${
                photos?.length
              } фото ${Object.keys(checks).map((key) =>
                typeof checks[key] === 'boolean'
                  ? checks[key]
                    ? '✅'
                    : '❌'
                  : '?'
              )}`,
              c: {
                c: 'gameTeamCheckPhotosInTask',
                gameTeamId: jsonCommand?.gameTeamId,
                i: number - 1,
              },
            }
          }
        )
      : []

  return {
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b> у команды "<b>${team.name}</b>"`,
    buttons: [
      ...buttons,
      {
        c: { c: 'gameTeamsCheckPhotos', gameId: gameTeam?.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamsCheckPhotos