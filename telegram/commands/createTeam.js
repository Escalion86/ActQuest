import TeamsUsers from '@models/TeamsUsers'
// import dbConnect from '@utils/dbConnect'
import { MAX_TEAMS } from 'telegram/constants'
import createTeamFunc from 'telegram/func/createTeamFunc'

const array = [
  {
    prop: 'name',
    message: 'Введите название команды',
    answerMessage: (answer) => `Задано название команды: "${answer}"`,
    buttons: (jsonCommand) => [{ c: 'menuTeams', text: '\u{2B05} Назад' }],
  },
  // {
  //   prop: 'description',
  //   message: 'Введите описание команды (не обязательно)',
  //   answerMessage: (answer) => `Задано описание команды "${answer}"`,
  //   buttons: (jsonCommand) => [
  //     {
  //       c: { description: '' },
  //       text: 'Без описания',
  //     },
  //     { c: 'menuTeams', text: '\u{2B05} Назад' },
  //   ],
  // },
]

const createTeam = async ({ telegramId, jsonCommand }) => {
  // await dbConnect() // TODO: Нужно ли это?
  const teamsUser = await TeamsUsers.find({
    userTelegramId: telegramId,
  })
  if (teamsUser.length >= MAX_TEAMS) {
    return {
      message: `Нельзя состоять более чем в ${MAX_TEAMS} командах. Для создания команды сначала покиньте одну из команд`,
      nextCommand: `joinedTeams`,
    }
  }

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
      const value = jsonCommand.message
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

  // Если все переменные на месте, то создаем команду
  const team = await createTeamFunc(telegramId, jsonCommand)

  return {
    success: true,
    message: `Команда "${jsonCommand.name}" создана!\nДля присоединения к команде участников кликните по коду, чтобы скопировать его:\n\n<code>${team._id}</code>\n\nЗатем отправьте пользователям, которых хотите пригласить. Этот код необходимо ввести пользователям в поле "Команды" => "Присоединиться к команде"`,
    nextCommand: `menuTeams`,
  }
}

export default createTeam
