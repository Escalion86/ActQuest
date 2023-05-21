import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'
import propsToStr from 'telegram/func/propsToStr'

const array = [
  {
    prop: 'teamName',
    message: 'Введите название команды',
    answerMessage: (answer) => `Задано название команды "${answer}"`,
  },
  {
    prop: 'teamDescription',
    message: 'Введите описание команды',
    answerMessage: (answer) => `Задано описание команды "${answer}"`,
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

const create_team = async ({ telegramId, message, props }) => {
  // Если это запрос (команда), то отправляем текст пользователю
  if (!message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (!props[data.prop])
        return {
          success: true,
          message: data.message,
          // nextCommand: `/menu_teams`,
        }
    }
  }
  // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (!props[data.prop]) {
      props[data.prop] = message
      if (i < array.length - 1)
        return {
          success: true,
          message: array[i + 1].answerMessage(message),
          nextCommand: `/create_team` + propsToStr(props),
        }
    }
  }

  // Если все переменные на месте, то создаем команду
  await dbConnect()
  const team = await createTeam(
    telegramId,
    props?.teamName,
    props.teamDescription
  )

  return {
    success: true,
    message: `Команда "${props?.teamName}" создана`,
    nextCommand: `/menu_teams`,
  }
}

export default create_team
