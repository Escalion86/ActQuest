import createGame from 'telegram/func/createGame'
import propsToStr from 'telegram/func/propsToStr'

const array = [
  {
    prop: 'name',
    message: 'Введите название игры',
    answerMessage: (answer) => `Задано название игры "${answer}"`,
    buttons: (props) => [{ command: 'menu_games', text: '\u{2B05} Назад' }],
  },
  {
    prop: 'description',
    message: 'Введите описание игры',
    answerMessage: (answer) => `Задано описание игры "${answer}"`,
    buttons: (props) => [{ command: 'menu_games', text: '\u{2B05} Назад' }],
  },
  {
    prop: 'dateStart',
    message: 'Введите дату игры (без времени) в формате dd.MM.yyyy',
    checkAnswer: (answer) =>
      '^(?:(?:31(/|-|.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(/|-|.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]d)?d{2})$|^(?:29(/|-|.)0?2\3(?:(?:(?:1[6-9]|[2-9]d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1d|2[0-8])(/|-|.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]d)?d{2})$'.test(
        answer
      ),
    errorMessage: (answer) =>
      `Дата задана в неверном формате. Формат даты должен соответствовать dd.MM.yyyy`,
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
      if (
        array[i].checkAnswer !== undefined &&
        !array[i].checkAnswer(message)
      ) {
        return {
          success: false,
          message: array[i].errorMessage(message),
          // buttons: data.buttons(props),
          nextCommand: `/create_game` + propsToStr(props),
        }
      }
      props[data.prop] = message
      if (i < array.length - 1)
        return {
          success: true,
          message: array[i].answerMessage(message),
          // buttons: data.buttons(props),
          nextCommand: `/create_game` + propsToStr(props),
        }
    }
  }

  // Если все переменные на месте, то создаем команду
  const game = await createGame(telegramId, props)

  return {
    success: true,
    message: `Игра "${props.gameName}" создана`,
    nextCommand: `/menu_games`,
  }
}

export default create_game
