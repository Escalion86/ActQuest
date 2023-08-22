import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import moment from 'moment-timezone'
import { CLUE_DURATION_SEC } from 'telegram/constants'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const sortFunc = (a, b) => {
  const isNumericA = typeof a.seconds === 'number'
  const isNumericB = typeof b.seconds === 'number'

  if (isNumericA && isNumericB) {
    return a.seconds - b.seconds
  }

  if (isNumericA && !isNumericB) {
    return -1
  }

  if (!isNumericA && isNumericB) {
    return 1
  }
  return 0
}

const getAverage = (numbers) =>
  Math.round(numbers.reduce((acc, number) => acc + number, 0) / numbers.length)

const durationCalc = ({ startTime, endTime, activeNum }) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  for (let i = 0; i < startTime.length; i++) {
    if (activeNum > i) {
      if (!endTime[i]) tempArray.push(CLUE_DURATION_SEC * 3)
      else tempArray.push(getSecondsBetween(startTime[i], endTime[i]))
    } else if (activeNum === i) {
      tempArray.push('[не завершено]')
    } else {
      tempArray.push('[не начато]')
    }
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

  if (!game.result) {
    return {
      message: 'Результаты игры еще не сформированы',
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  return {
    message: game.result.text,
    buttons: [
      {
        text: '\u{2B05} Назад',
        c: { c: 'game', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameResult
