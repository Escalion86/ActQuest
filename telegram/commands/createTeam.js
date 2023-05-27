import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'

const array = [
  {
    prop: 'name',
    message: 'Введите название команды',
    answerMessage: (answer) => `Задано название команды "${answer}"`,
    buttons: (jsonCommand) => [{ cmd: 'menuTeams', text: '\u{2B05} Назад' }],
  },
  {
    prop: 'description',
    message: 'Введите описание команды',
    answerMessage: (answer) => `Задано описание команды "${answer}"`,
    buttons: (jsonCommand) => [
      {
        cmd: { description: '' },
        // command: 'createTeam' + propsToStr(props) + '/teamDescription=',
        text: 'Без описания',
      },
      { cmd: 'menuTeams', text: '\u{2B05} Назад' },
    ],
  },
]

// const commandSample = {
//   propsNeeded: [
//     {
//       prop: 'teamName',
//       message: 'Введите название команды',
//       answerMessage: (answer) => `Задано название команды "${answer}"`,
//     },
//     {
//       prop: 'teamDescription',
//       message: 'Введите описание команды',
//       answerMessage: (answer) => `Задано описание команды "${answer}"`,
//     },
//   ],
//   messageOnSuccess: (data) => `Команда "${data.name}" создана`
// }

const createTeam = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teamsUser = await TeamsUsers.find({
    userTelegramId: telegramId,
  })
  if (teamsUser.length >= 3) {
    return {
      message:
        'Нельзя состоять более чем в 3 командах. Для создания команды сначала покиньте одну из команд',
      nextCommand: `menuTeams`,
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
      if (i < array.length - 1)
        return {
          success: true,
          message: array[i].answerMessage(jsonCommand.message),
          buttons: data.buttons(jsonCommand),
          nextCommand: { [data.prop]: jsonCommand.message },
        }
    }
  }

  // Если все переменные на месте, то создаем команду
  const team = await createTeam(telegramId, jsonCommand)

  return {
    success: true,
    message: `Команда "${jsonCommand.name}" создана`,
    nextCommand: `menuTeams`,
  }
}

export default createTeam
