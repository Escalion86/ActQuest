import createGame from 'telegram/func/createGame'
import propsToStr from 'telegram/func/propsToStr'

const array = [
  {
    prop: 'gameName',
    message: 'Введите название игры',
    answerMessage: (answer) => `Задано название игры "${answer}"`,
    buttons: (props) => [{ command: 'menu_games', text: '\u{2B05} Назад' }],
  },
  {
    prop: 'gameDescription',
    message: 'Введите описание игры',
    answerMessage: (answer) => `Задано описание игры "${answer}"`,
    buttons: (props) => [{ command: 'menu_games', text: '\u{2B05} Назад' }],
  },
]

const create_game = async ({ telegramId, message, props }) => {
  // Если это запрос (команда), то отправляем текст пользователю
  if (!message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (props[data.prop] === undefined) {
        return {
          success: true,
          message: data.message,
          buttons: data.buttons(props),
          // nextCommand: `/menu_teams`,
        }
      }
    }
  }

  // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (props[data.prop] === undefined) {
      props[data.prop] = message
      if (i < array.length - 1)
        return {
          success: true,
          message: array[i].answerMessage(message),
          buttons: data.buttons(props),
          nextCommand: `/create_game` + propsToStr(props),
        }
    }
  }

  // Если все переменные на месте, то создаем команду
  const game = await createGame(
    telegramId,
    props.teamName,
    props.teamDescription
  )

  return {
    success: true,
    message: `Игра "${props.gameName}" создана`,
    nextCommand: `/menu_games`,
  }
}

export default create_game
