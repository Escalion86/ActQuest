import GamesTeams from '@models/GamesTeams'
import arrayOfCommands from 'telegram/func/arrayOfCommands'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'
// import { v4 as uuidv4 } from 'uuid'

const cancelButton = (jsonCommand) => ({
  c: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  text: '\u{1F6AB} Отмена создания штрафа для команды',
})

const array = [
  {
    prop: 'name',
    message: 'Введите название штрафа',
    answerMessage: (answer) => `Название штрафа"${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'time',
    message: 'Введите штраф в секундах',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Штраф должен быть в секундах и больше нуля!`,
    answerMessage: (answer) =>
      `Задан штраф по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addGameTeamAddingPenalty = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newAdding = {
        // id: uuidv4(),
        name: result.name,
        time: result.time,
      }

      await GamesTeams.findByIdAndUpdate(jsonCommand.gameTeamId, {
        timeAddings: [...(gameTeam.timeAddings ?? []), newAdding],
      })

      return {
        success: true,
        message: 'Штраф добавлен',
        nextCommand: {
          c: 'gameTeamAddings',
          gameTeamId: jsonCommand.gameTeamId,
        },
      }
    },
  })
}

export default addGameTeamAddingPenalty
