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

  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const breakDuration = game.breakDuration ?? 0

  const sortedTeams = [
    ...teams.map((team) => {
      const gameTeam = gameTeams.find(
        (gameTeam) => gameTeam.teamId === String(team._id)
      )
      const {
        activeNum,
        findedCodes,
        startTime,
        findedBonusCodes,
        findedPenaltyCodes,
      } = gameTeam
      const activeTaskIndex = activeNum

      var startedTasks = 0
      startTime.forEach((time) => {
        if (time) ++startedTasks
      })

      console.log('startedTasks :>> ', startedTasks)

      const findedCodesCount =
        findedCodes?.length >= startedTasks
          ? findedCodes[activeTaskIndex]?.length ?? 0
          : 0
      const findedBonusCodesCount =
        findedBonusCodes?.length >= startedTasks
          ? findedBonusCodes[activeTaskIndex]?.length ?? 0
          : 0
      const findedPenaltyCodesCount =
        findedPenaltyCodes?.length >= startedTasks
          ? findedPenaltyCodes[activeTaskIndex]?.length ?? 0
          : 0
      const allFindedCodesCount =
        findedCodesCount + findedBonusCodesCount + findedPenaltyCodesCount

      return {
        team,
        startedTasks,
        activeTaskIndex,
        gameTeam,
        allFindedCodesCount,
        findedCodesCount,
        findedBonusCodesCount,
        findedPenaltyCodesCount,
      }
    }),
  ].sort((a, b) =>
    b.startedTasks - a.startedTasks === 0
      ? b.findedCodesCount - a.findedCodesCount
      : b.startedTasks - a.startedTasks
  )

  const textArray = sortedTeams.map(
    ({
      team,
      startedTasks,
      activeTaskIndex,
      gameTeam,
      findedCodesCount,
      findedBonusCodesCount,
      findedPenaltyCodesCount,
    }) => {
      const isActiveTaskFinished =
        gameTeam.endTime[activeTaskIndex] ||
        getSecondsBetween(gameTeam.startTime[activeTaskIndex]) > taskDuration
      const isAllTasksStarted =
        gameTeam.startTime?.length === game.tasks.length &&
        gameTeam.startTime.filter((item) => item).length === game.tasks.length
      const isTeamFinished = isAllTasksStarted && isActiveTaskFinished

      if (isTeamFinished)
        return `\u{2705} <b>"${team.name}"</b> - завершили все задания`

      const isTeamOnBreak = !!breakDuration && isActiveTaskFinished
      // Проверяем, может задание выполнено или провалено и команда на перерыве
      if (isTeamOnBreak) {
        const timeAfterEndTask = gameTeam.endTime[activeTaskIndex]
          ? getSecondsBetween(gameTeam.endTime[activeTaskIndex])
          : getSecondsBetween(gameTeam.startTime[activeTaskIndex]) +
            taskDuration
        const breakTimeLeft = breakDuration - timeAfterEndTask
        const nextTask = game.tasks[startedTasks]
        const taskNumber = numberToEmojis(startedTasks + 1)
        return `\u{1F6AC}\u{1F51C}${taskNumber} <b>"${
          team.name
        }"</b> - перерыв, до окончания перерыва ${secondsToTime(
          breakTimeLeft
        )}, след. задание №${startedTasks + 1} "${nextTask.title}"`
      }

      const taskNumber = numberToEmojis(startedTasks)
      const task = game.tasks[startedTasks - 1]
      const taskSecondsLeft = Math.floor(
        getSecondsBetween(gameTeam.startTime[startedTasks - 1])
      )
      const showCluesNum =
        cluesDuration > 0 ? Math.floor(taskSecondsLeft / cluesDuration) : 0

      return `\u{1F3C3}${taskNumber} <b>"${
        team.name
      }"</b> - задание №${startedTasks} "${task.title}"${
        showCluesNum > 0 ? `, получена подсказка №${showCluesNum}` : ''
      } (осталось ${secondsToTime(taskDuration - taskSecondsLeft)}).${
        findedCodesCount > 0
          ? `\nНайденые коды (${findedCodesCount} шт.): "${gameTeam.findedCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }${
        findedBonusCodesCount > 0
          ? `\nНайденые бонусные коды (${findedBonusCodesCount} шт.): "${gameTeam.findedBonusCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }${
        findedPenaltyCodesCount > 0
          ? `\nНайденые штрафные коды (${findedPenaltyCodesCount} шт.): "${gameTeam.findedPenaltyCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }`
    }
  )

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
