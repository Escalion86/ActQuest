import { getNounPoints } from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'
import numberToEmojis from 'telegram/func/numberToEmojis'

const gameTeamsCheckPhotos = async ({ telegramId, jsonCommand, user }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const activeNum = gameTeam?.activeNum
  const page = jsonCommand?.page ?? 1
  const buttons =
    gameTeam?.photos?.length > 0
      ? buttonListConstructor(
          gameTeam.photos,
          page,
          ({ photos, checks }, number) => {
            const task = game.tasks[number - 1]
            const subTasks = task.subTasks

            const isTaskFinished = activeNum > number - 1
            const isTaskInProcessed = activeNum === number - 1

            const filteredPhotos = photos?.filter((photo) => photo) || []
            if (filteredPhotos?.length === 0)
              return {
                text: `${
                  isTaskFinished
                    ? `✅`
                    : isTaskInProcessed
                    ? `\u{1F3C3}`
                    : '\u{23F3}'
                }${numberToEmojis(number)} "${
                  task.title
                }" - 0 фото - ?${subTasks.map(() => '?').join('?')} - 0 б.`,
                c: {
                  c: 'gameTeamCheckPhotosInTask',
                  gameTeamId: jsonCommand?.gameTeamId,
                  i: number - 1,
                },
              }
            const checksKeys = Object.keys(checks)

            const taskAccepted = checks?.accepted

            const notCheckedTasksCount = subTasks.filter(
              ({ _id }) => !checksKeys.includes(String(_id))
            ).length

            // const checks = gameTeam.photos[index]?.checks || {}
            // const taskAccepted = checks.accepted
            const sumResult = taskAccepted
              ? (task.taskBonusForComplite || 0) +
                (subTasks.length > 0
                  ? subTasks.reduce(
                      (sum, { _id, bonus }) =>
                        sum + (checks[String(_id)] ? Number(bonus || 0) : 0),
                      0
                    )
                  : 0)
              : 0

            return {
              text: `${
                isTaskFinished
                  ? `✅`
                  : isTaskInProcessed
                  ? `\u{1F3C3}`
                  : '\u{23F3}'
              }${numberToEmojis(number)} "${task.title}" - ${
                filteredPhotos?.length
              } фото ${
                typeof taskAccepted !== 'boolean'
                  ? '\u{2757}'
                  : !taskAccepted
                  ? '❌'
                  : notCheckedTasksCount > 0
                  ? '\u{2757}'
                  : '✅'
              } - ${sumResult} б.`,
              // text: `${number}. "${game.tasks[number - 1].title}" - ${
              //   filteredPhotos?.length
              // } фото - ${
              //   typeof taskAccepted === 'boolean'
              //     ? taskAccepted
              //       ? '✅'
              //       : '❌'
              //     : '?'
              // }${subTasks
              //   .map(({ _id }) => {
              //     const key = String(_id)
              //     return typeof checks[key] === 'boolean'
              //       ? checks[key]
              //         ? '✅'
              //         : '❌'
              //       : '?'
              //   })
              //   .join('')} - ${sumResult} б.`,
              c: {
                c: 'gameTeamCheckPhotosInTask',
                gameTeamId: jsonCommand?.gameTeamId,
                i: number - 1,
              },
            }
          }
        )
      : []

  const sumResult = game.tasks.reduce(
    (sum, { subTasks, taskBonusForComplite }, index) => {
      const checks = gameTeam.photos[index]?.checks || {}
      const taskAccepted = checks.accepted
      if (!taskAccepted) return sum

      return (
        sum +
        (taskBonusForComplite || 0) +
        (subTasks.length > 0
          ? subTasks.reduce(
              (sum, { _id, bonus }) =>
                sum + (checks[String(_id)] ? Number(bonus || 0) : 0),
              0
            )
          : 0)
      )
    },
    0
  )

  return {
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b> у команды "<b>${
      team.name
    }</b>"\n\n<b>Суммарный результат за задание</b>: ${getNounPoints(
      sumResult
    )}`,
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
