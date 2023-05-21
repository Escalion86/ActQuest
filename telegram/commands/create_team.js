import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'

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

const propsToStr = (props) => {
  const tempArray = []
  for (const key in props) {
    tempArray.push(`${key}=${props[key]}`)
  }
  const result = tempArray.join('/')
  return tempArray.length > 0 ? '/' + result : ''
}

const create_team = async ({ telegramId, message, props }) => {
  await dbConnect()
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
