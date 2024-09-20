import { getNounPoints } from '@helpers/getNoun'
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

  if (gameTeam.photos[jsonCommand.i]?.length === 0) {
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
    gameTeam.photos.map((item, i) => {
      if (i === jsonCommand?.i) {
        item.checks[jsonCommand.subTaskAcceptChange] =
          !item.checks[jsonCommand.subTaskAcceptChange]
      }
      return item
    })
    return {
      nextCommand: {},
    }
  }

  if (jsonCommand?.taskAcceptChange) {
    gameTeam.photos.map((item, i) => {
      if (i === jsonCommand?.i) {
        item.checks.accepted = !item.checks?.accepted
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
          ({ _id, name, task, bonus }, number) => {
            const accepted = gameTeam.photos[number - 1]?.checks
              ? gameTeam.photos[number - 1]?.checks[String(_id)]
              : undefined
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

  const taskAccepted = gameTeam.photos[jsonCommand.i]?.accepted

  return {
    images: gameTeam.photos[jsonCommand.i].photos,
    message: `Проверка фотографий в игре <b>${formatGameName(
      game
    )}</b> у команды "<b>${team.name}</b>"\n\n<b>Список доп. заданий</b>:${
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
    }`,
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
