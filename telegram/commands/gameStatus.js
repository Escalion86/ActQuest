import dateToDateTimeStr from '@helpers/dateToDateTimeStr'
import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'
import secondsToTime from 'telegram/func/secondsToTime'

const gameStatus = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'started') {
    return {
      message: 'Игра должна быть в процессе',
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  // Получаем список команд участвующих в игре
  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const sortedTeams = [
    ...teams.map((team) => {
      const gameTeam = gameTeams.find(
        (gameTeam) => gameTeam.teamId === String(team._id)
      )
      var startedTasks = 0
      gameTeam.startTime.forEach((time) => {
        if (time) ++startedTasks
      })
      return { team, startedTasks, gameTeam }
    }),
  ].sort((a, b) => b.startedTasks - a.startedTasks)

  const textArray = sortedTeams.map(({ team, startedTasks, gameTeam }) => {
    const findedCodes =
      gameTeam.findedCodes?.length >= startedTasks
        ? gameTeam.findedCodes[startedTasks - 1]?.length ?? 0
        : 0
    const findedBonusCodes =
      gameTeam.findedBonusCodes?.length >= startedTasks
        ? gameTeam.findedBonusCodes[startedTasks - 1]?.length ?? 0
        : 0
    const findedPenaltyCodes =
      gameTeam.findedPenaltyCodes?.length >= startedTasks
        ? gameTeam.findedPenaltyCodes[startedTasks - 1]?.length ?? 0
        : 0
    const taskDuration = game.taskDuration ?? 3600

    const isTeamFinished =
      gameTeam.endTime[game.tasks.length - 1] ||
      (gameTeam.startTime[game.tasks.length - 1] &&
        getSecondsBetween(gameTeam.startTime[game.tasks.length - 1]) >
          taskDuration)

    if (isTeamFinished)
      return `\u{2705} <b>"${team.name}"</b> - завершили все задания`

    // Проверяем, может задание выполнено и команда на перерыве
    if (gameTeam.endTime[startedTasks - 1]) {
      const nextTask = game.tasks[startedTasks]
      const taskNumber = numberToEmojis(startedTasks + 1)
      return `\u{1F6AC}\u{1F51C}${taskNumber} <b>"${
        team.name
      }"</b> - перерыв, след. задание №${startedTasks + 1} "${nextTask.title}"`
    }

    const taskNumber = numberToEmojis(startedTasks)
    const task = game.tasks[startedTasks - 1]
    const timeLeft = secondsToTime(
      taskDuration - getSecondsBetween(gameTeam.startTime[startedTasks - 1])
    )

    return `\u{1F3C3}${taskNumber} <b>"${
      team.name
    }"</b> - выполняют задание №${startedTasks} "${
      task.title
    }" (осталось ${timeLeft})).${
      findedCodes > 0
        ? `\nНайденые коды (${findedCodes} шт.): "${gameTeam.findedCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }${
      findedBonusCodes > 0
        ? `\nНайденые бонусные коды (${findedBonusCodes} шт.): "${gameTeam.findedBonusCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }${
      findedPenaltyCodes > 0
        ? `\nНайденые штрафные коды (${findedPenaltyCodes} шт.): "${gameTeam.findedPenaltyCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }`
  })

  const text = textArray.join('\n\n')

  // const tasksDuration = gameTeams.map((gameTeam) => ({
  //   teamId: gameTeam.teamId,
  //   duration: durationCalc(gameTeam),
  // }))

  // const text = game.tasks.map((task, index) => {
  //   return `\n\n<b>Задание "${task.title}"</b>${teams.map((team) => {
  //     const dur = tasksDuration.find((item) => item.teamId === String(team._id))
  //     return `\n- ${team.name} - ${secondsToTime(dur?.duration[index])}`
  //   })}`
  // })

  return {
    message: `<b>Состояние игры "${game.name}"</b>\n${dateToDateTimeStr(
      new Date(),
      false,
      false,
      false,
      false
    ).join(' ')}\n\n${text}`,
    buttons: [
      {
        text: '\u{1F504} Обновить статус игры',
        c: { c: 'gameStatus', gameId: jsonCommand.gameId },
      },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGame', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameStatus
