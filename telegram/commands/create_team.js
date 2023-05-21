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
  console.log('props :>> ', props)
  // Если задаем имя
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

    // Если имя уже задано, значит сейчас идет ввод описания
    const team = await createTeam(telegramId, props?.teamName, message)

    return { success: true, message: `Команда "${props?.teamName}" создана` }
  }

  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (!props[data.prop])
      return {
        success: true,
        message: data.answerMessage(message),
        nextCommand: `/create_team` + propsToStr(props),
      }
  }

  return {
    success: false,
    message: `create_team ОШИБКА`,
  }
}

export default create_team
