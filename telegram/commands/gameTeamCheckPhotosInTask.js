import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamCheckPhotosInTask = async ({ telegramId, jsonCommand, user }) => {
  const checkData = check(jsonCommand, ['gameTeamId', 'i'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const task = game.tasks[jsonCommand.i]
  const subTasks = task.subTasks

  if (typeof jsonCommand?.subTaskAcceptChange === 'number') {
    gameTeam.photos.map((item, i) => {
      if (i === jsonCommand?.subTaskAcceptChange) {
        item.accepted = !item.accepted
      }
      return item
    })
    return { nextCommand: {} }
  }

  const page = jsonCommand?.page ?? 1
  const buttons =
    subTasks?.length > 0
      ? buttonListConstructor(
          subTasks,
          page,
          ({ name, task, bonus }, number) => {
            const accepted = gameTeam.photos[number - 1]?.accepted
            return {
              text: `"${name}" - ${
                typeof accepted === 'boolean' ? (accepted ? '✅' : '❌') : '?'
              }`,
              c: {
                subTaskAcceptChange: number - 1,
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
        c: { c: 'gameTeamCheckPhotos', gameTeamId: jsonCommand?.gameTeamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamCheckPhotosInTask
