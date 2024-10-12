import GamesTeams from '@models/GamesTeams'
import arrayOfCommands from 'telegram/func/arrayOfCommands'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const cancelButton = (jsonCommand) => ({
  c: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  text: '\u{1F6AB} Отмена создания бонуса для команды',
})

const array = [
  {
    prop: 'name',
    message: 'Введите название бонуса',
    answerMessage: (answer) => `Название бонуса"${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'time',
    message: 'Введите бонус в секундах',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Бонус должен быть в секундах и больше нуля!`,
    answerConverter: (answer) => answer * -1,
    answerMessage: (answer) =>
      `Задан бонус по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addGameTeamAddingBonus = async ({ telegramId, jsonCommand }) => {
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
        message: 'Бонус добавлен',
        nextCommand: {
          c: 'gameTeamAddings',
          gameTeamId: jsonCommand.gameTeamId,
        },
      }
    },
  })
}

export default addGameTeamAddingBonus
