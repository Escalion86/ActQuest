import createGame from 'telegram/func/createGame'
import propsToStr from 'telegram/func/propsToStr'

const array = [
  {
    prop: 'name',
    message: 'Введите название игры',
    answerMessage: (answer) => `Задано название игры "${answer}"`,
    buttons: (props) => [
      { command: 'menu_games', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'description',
    message: 'Введите описание игры',
    answerMessage: (answer) => `Задано описание игры "${answer}"`,
    buttons: (props) => [
      { command: 'menu_games', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'dateStart',
    message: 'Введите дату и время игры в формате "dd.MM.yyyy hh:mm"',
    checkAnswer: (answer) =>
      // '^(?:(?:31(/|-|.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(/|-|.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]d)?d{2})$|^(?:29(/|-|.)0?2\3(?:(?:(?:1[6-9]|[2-9]d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1d|2[0-8])(/|-|.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]d)?d{2})$'.test(
      /^([1-9]|([012][0-9])|(3[01]))\.([0]{0,1}[1-9]|1[012])\.\d\d\d\d\s([0-1]?[0-9]|2?[0-3]):([0-5]\d)$/.test(
        answer
      ),
    errorMessage: (answer) =>
      `Дата и время заданы в неверном формате. Формат даты и времени должен соответствовать "dd.MM.yyyy hh:mm"`,
    answerMessage: (answer) => `Заданы дата и время игры "${answer}"`,
    buttons: (props) => [
      { command: 'menu_games', text: '\u{1F6AB} Отмена создания игры' },
    ],
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
    message: `Игра "${props.name}" создана`,
    nextCommand: `/menu_games`,
  }
}

export default create_game
