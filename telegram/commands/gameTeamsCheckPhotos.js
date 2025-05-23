import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'

const gameTeamsCheckPhotos = async ({ telegramId, jsonCommand, user, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId, db)
  if (game.success === false) return game

  const gameTeams = await db
    .model('GamesTeams')
    .find({ gameId: jsonCommand?.gameId })
    .lean()
    .sort({ createdAt: 1 })

  const teamsIds =
    gameTeams.length > 0 ? gameTeams.map((gameTeam) => gameTeam.teamId) : []

  const teams =
    teamsIds.length > 0
      ? await db
          .model('Teams')
          .find({
            _id: { $in: teamsIds },
          })
          .lean()
      : []

  const sortedTeams = gameTeams.map(({ _id, teamId, photos, activeNum }) => {
    const team = teams.find(({ _id }) => String(_id) == teamId)
    return { ...team, photos, gameTeamId: _id, activeNum }
  })

  const page = jsonCommand?.page ?? 1
  const buttons =
    sortedTeams.length > 0
      ? buttonListConstructor(
          sortedTeams,
          page,
          ({ photos, gameTeamId, name, activeNum }, number) => {
            const notAllTasksFullyChecked = game.tasks.some(
              ({ subTasks }, i) => {
                if (!photos[i]?.photos?.length) return false
                const checks = photos[i]?.checks
                return (
                  i <= activeNum &&
                  (!checks ||
                    (Object.keys(checks).length || 0) !==
                      (subTasks?.length || 0) + 1)
                )
              }
            )
            return {
              text: `${number}. "${name}" - ${
                photos?.length > 0
                  ? `${photos.reduce((sum, { photos, checks }) => {
                      const filteredPhotos = photos?.filter((photo) => photo)
                      return sum + (filteredPhotos?.length || 0)
                    }, 0)} фото ${notAllTasksFullyChecked ? '\u{2757}' : '✅'}`
                  : '0 фото'
              } - ${
                activeNum >= game.tasks.length
                  ? `\u{1F3C1}`
                  : `\u{1F3C3}${numberToEmojis(activeNum + 1)}`
              }`,
              c: { c: 'gameTeamCheckPhotos', gameTeamId },
            }
          }
        )
      : []

  return {
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b>\n${sortedTeams
      .map(
        (team, index) =>
          `\n${index + 1}. "${team.name}" - ${
            team.photos?.length > 0
              ? `${team.photos.reduce(
                  (sum, { photos, checks }) =>
                    sum + (photos?.filter((photo) => photo).length || 0),
                  0
                )} фото`
              : '0 фото'
          }`
      )
      .join('')}`,
    buttons: [
      ...buttons,
      {
        c: { c: 'editGameGeneral', gameId: jsonCommand?.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamsCheckPhotos
