import GamesTeams from '@models/GamesTeams'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'
// import { v4 as uuidv4 } from 'uuid'

const cancelButton = (jsonCommand) => ({
  c: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  text: '\u{1F6AB} Отмена создания бонуса/штрафа для команды',
})

const array = [
  {
    prop: 'name',
    message: 'Введите название бонуса/штрафа',
    answerMessage: (answer) => `Название бонуса/штрафа"${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'time',
    message: 'Введите бонсу/штраф в секундах (если бонус то со знаком "-")',
    answerMessage: (answer) =>
      `Задан бонус/штраф по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addGameTeamAdding = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  // Если это запрос (команда), то отправляем текст пользователю
  if (!jsonCommand.message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (jsonCommand[data.prop] === undefined) {
        return {
          success: true,
          message: data.message,
          buttons: data.buttons(jsonCommand),
          // nextCommand: `/menuTeams`,
        }
      }
    }
  }

  // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (jsonCommand[data.prop] === undefined) {
      const value =
        typeof array[i].answerConverter === 'function'
          ? array[i].answerConverter(jsonCommand.message)
          : jsonCommand.message

      if (i < array.length - 1) {
        return {
          success: true,
          message: array[i].answerMessage(value),
          // buttons: data.buttons(jsonCommand),
          nextCommand: { [data.prop]: value },
        }
      } else {
        jsonCommand[data.prop] = value
      }
    }
  }

  const newAdding = {
    // id: uuidv4(),
    name: jsonCommand.name,
    time: jsonCommand.time,
  }

  // await dbConnect() // TODO: Нужно ли это?
  await GamesTeams.findByIdAndUpdate(jsonCommand.gameTeamId, {
    timeAddings: [...(gameTeam.timeAddings ?? []), newAdding],
  })

  return {
    success: true,
    message: 'Бонус/штраф добавлен',
    nextCommand: { c: 'gameTeamAddings', gameTeamId: jsonCommand.gameTeamId },
  }
}

export default addGameTeamAdding
