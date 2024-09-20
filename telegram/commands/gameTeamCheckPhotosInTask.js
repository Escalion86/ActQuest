import { getNounPoints } from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
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

  if (!gameTeam.photos[jsonCommand.i]?.photos?.length) {
    return {
      message: `Команда не отправила ни одного фото на это задание`,
      nextCommand: {
        c: 'gameTeamCheckPhotos',
        gameTeamId: jsonCommand?.gameTeamId,
      },
    }
  }

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const task = game.tasks[jsonCommand.i]
  const subTasks = task.subTasks

  if (jsonCommand?.subTaskAcceptChange) {
    const newPhotos = [...gameTeam.photos]
    newPhotos.map((item, i) => {
      if (i === jsonCommand?.i) {
        item.checks[jsonCommand.subTaskAcceptChange] =
          !item.checks[jsonCommand.subTaskAcceptChange]
      }
      return item
    })
    await GamesTeams.findByIdAndUpdate(gameTeam._id, {
      photos: newPhotos,
    })
    return {
      nextCommand: { subTaskAcceptChange: false },
    }
  }

  if (jsonCommand?.taskAcceptChange) {
    const newPhotos = [...gameTeam.photos]
    newPhotos.map((item, i) => {
      if (i === jsonCommand?.i) {
        item.checks.accepted = !item.checks?.accepted
      }
      return item
    })
    await GamesTeams.findByIdAndUpdate(gameTeam._id, {
      photos: newPhotos,
    })
    return { nextCommand: { taskAcceptChange: false } }
  }

  const checks = gameTeam.photos[jsonCommand.i]?.checks
  const photos = gameTeam.photos[jsonCommand.i]?.photos?.filter(
    (photo) => photo
  )

  const page = jsonCommand?.page ?? 1
  const buttons =
    subTasks?.length > 0
      ? buttonListConstructor(
          subTasks,
          page,
          ({ _id, name, task, bonus }, number) => {
            const accepted = checks ? checks[String(_id)] : undefined
            return {
              text: `"${name}" - ${
                typeof accepted === 'boolean' ? (accepted ? '✅' : '❌') : '?'
              }`,
              c: {
                subTaskAcceptChange: String(_id),
              },
            }
          }
        )
      : []

  const taskAccepted = checks?.accepted

  const sumResult = taskAccepted
    ? (task.taskBonusForComplite || 0) +
      (task?.subTasks.length > 0
        ? task?.subTasks.reduce(
            (sum, { _id, bonus }) =>
              sum + (checks[String(_id)] ? Number(bonus || 0) : 0),
            0
          )
        : 0)
    : 0

  return {
    images:
      typeof jsonCommand?.subTaskAcceptChange === 'boolean' ||
      typeof jsonCommand?.taskAcceptChange === 'boolean'
        ? undefined
        : photos,
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b> у команды "<b>${
      team.name
    }</b>"\n\n<b>Бонус за выполнение задания</b>: ${getNounPoints(
      task.taskBonusForComplite || 0
    )} ${
      typeof taskAccepted === 'boolean' ? (taskAccepted ? '✅' : '❌') : '?'
    }\n<b>Список доп. заданий</b>:${
      !task?.subTasks?.length
        ? ' пуст'
        : `\n${
            task?.subTasks.length > 0
              ? task?.subTasks
                  .map(({ _id, name, task, bonus }, i) => {
                    const accepted = gameTeam.photos[jsonCommand.i]?.checks
                      ? gameTeam.photos[jsonCommand.i]?.checks[String(_id)]
                      : undefined
                    return `"${name}" - ${getNounPoints(bonus)}${
                      typeof accepted === 'boolean'
                        ? accepted
                          ? '✅'
                          : '❌'
                        : '?'
                    }\n<blockquote>${task}</blockquote>`
                  })
                  .join('')
              : ''
          }`
    }\n\n<b>Суммарный результат за задание</b>: ${getNounPoints(sumResult)}`,
    buttons: [
      {
        text: `Основное задание - ${
          typeof taskAccepted === 'boolean' ? (taskAccepted ? '✅' : '❌') : '?'
        }`,
        c: {
          taskAcceptChange: true,
        },
      },
      ...buttons,
      {
        c: { c: 'gameTeamCheckPhotos', gameTeamId: jsonCommand?.gameTeamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamCheckPhotosInTask
