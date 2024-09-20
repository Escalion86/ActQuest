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
            const subTasks = game.tasks[number - 1].subTasks

            const filteredPhotos = photos?.filter((photo) => photo)
            if (filteredPhotos?.length === 0)
              return {
                text: `${number}. "${
                  game.tasks[number - 1].title
                }" - 0 фото - ?${subTasks.map(() => '?').join('?')}`,
                c: {
                  c: 'gameTeamCheckPhotosInTask',
                  gameTeamId: jsonCommand?.gameTeamId,
                  i: number - 1,
                },
              }
            // const checksKeys = Object.keys(checks)

            // const notCheckedSubTasksCount = subTasks.filter(
            //   ({ _id }) => !checksKeys.includes(String(_id))
            // ).length
            const taskAccepted = checks.accepted

            return {
              // text: `${number}. "${game.tasks[number - 1].title}" - ${
              //   filteredPhotos?.length
              // } фото ${notCheckedSubTasksCount > 0 ? '\u{2757}' : '✅'}`,
              text: `${number}. "${game.tasks[number - 1].title}" - ${
                filteredPhotos?.length
              } фото - ${
                typeof taskAccepted === 'boolean'
                  ? taskAccepted
                    ? '✅'
                    : '❌'
                  : '?'
              }${subTasks
                .map(({ _id }) => {
                  const key = String(_id)
                  return typeof checks[key] === 'boolean'
                    ? checks[key]
                      ? '✅'
                      : '❌'
                    : '?'
                })
                .join('')}`,
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
