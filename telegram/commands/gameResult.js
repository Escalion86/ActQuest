import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const durationCalc = ({ startTime, endTime }) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  for (let i = 0; i < startTime.length; i++) {
    if (!endTime[i] || !startTime[i]) tempArray.push(CLUE_DURATION_SEC * 3)
    else tempArray.push(getSecondsBetween(startTime[i], endTime[i]))
  }
  return tempArray
}

const gameResult = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'finished') {
    return {
      message: 'Игра еще не завершена',
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

  const tasksDuration = gameTeams.map((gameTeam) => ({
    teamId: gameTeam.teamId,
    duration: durationCalc(gameTeam),
  }))

  const text = game.tasks
    .map((task, index) => {
      return `\n<b>Задание "${task.title}"</b>${teams.map((team) => {
        const dur = tasksDuration.find(
          (item) => item.teamId === String(team._id)
        )
        return `\n- ${team.name} - ${secondsToTime(dur?.duration[index])}`
      })}`
    })
    .join('\n')

  return {
    message: `<b>Результаты игры:</b>\n${text}`,
    buttons: [
      {
        text: '\u{2B05} Назад',
        c: 'editGame',
        gameId: jsonCommand.gameId,
      },
    ],
  }
}

export default gameResult
