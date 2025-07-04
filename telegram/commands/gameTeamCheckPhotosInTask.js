import { getNounPoints } from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamCheckPhotosInTask = async ({
  telegramId,
  jsonCommand,
  user,
  db,
}) => {
  const checkData = check(jsonCommand, ['gameTeamId', 'i'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId, db)
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

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  const task = game.tasks[jsonCommand.i]
  const subTasks = task.subTasks

  // if (jsonCommand?.subTaskAcceptChange) {
  //   const newPhotos = [...gameTeam.photos]
  //   newPhotos.map((item, i) => {
  //     if (i === jsonCommand?.i) {
  //       item.checks[jsonCommand.subTaskAcceptChange] =
  //         !item.checks[jsonCommand.subTaskAcceptChange]
  //     }
  //     return item
  //   })
  //   await db.model('GamesTeams').findByIdAndUpdate(gameTeam._id, {
  //     photos: newPhotos,
  //   })
  //   gameTeam.photos = newPhotos
  //   // return {
  //   //   nextCommand: { subTaskAcceptChange: false },
  //   // }
  // }

  // if (jsonCommand?.taskAcceptChange) {
  //   const newPhotos = [...gameTeam.photos]
  //   newPhotos.map((item, i) => {
  //     if (i === jsonCommand?.i) {
  //       item.checks.accepted = !item.checks?.accepted
  //     }
  //     return item
  //   })
  //   await db.model('GamesTeams').findByIdAndUpdate(gameTeam._id, {
  //     photos: newPhotos,
  //   })
  //   gameTeam.photos = newPhotos
  //   // return { nextCommand: { taskAcceptChange: false } }
  // }
  if (jsonCommand?.taskAcceptChange) {
    const newPhotos = [...gameTeam.photos]
    newPhotos.map((item, i) => {
      if (i === jsonCommand?.i) {
        item.checks[jsonCommand.taskAcceptChange] =
          !item.checks[jsonCommand.taskAcceptChange]
      }
      return item
    })
    await db.model('GamesTeams').findByIdAndUpdate(gameTeam._id, {
      photos: newPhotos,
    })
    gameTeam.photos = newPhotos
  }

  const checks = gameTeam.photos[jsonCommand.i]?.checks || {}
  const photos =
    gameTeam.photos[jsonCommand.i]?.photos?.filter((photo) => photo) || []

  const page = jsonCommand?.page ?? 1
  const buttons =
    subTasks?.length > 0
      ? buttonListConstructor(
          subTasks,
          page,
          ({ _id, name, task, bonus }, number) => {
            const accepted = checks ? checks[String(_id)] : undefined
            return {
              text: `${number}. "${name}" - ${
                typeof accepted === 'boolean' ? (accepted ? '✅' : '❌') : '?'
              }`,
              c: {
                taskAcceptChange: String(_id),
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
    images: jsonCommand?.taskAcceptChange ? undefined : photos,
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b> у команды "<b>${team.name}</b>"\n\n<b>Текст задания</b>:${
      !task?.task ? ' [не задано]' : `\n<blockquote>${task?.task}</blockquote>`
    }\n\n<b>Бонус за выполнение задания</b>: ${getNounPoints(
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
    }\n\n<b>Отправлено фото-ответов на задание</b>: ${
      photos.length
    } шт.\n\n<b>Суммарный максимум за задание</b>: ${getNounPoints(sumResult)}`,
    buttons: [
      {
        text: `Основное задание - ${
          typeof taskAccepted === 'boolean' ? (taskAccepted ? '✅' : '❌') : '?'
        }`,
        c: {
          taskAcceptChange: 'accepted',
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
