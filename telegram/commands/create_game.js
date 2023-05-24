import createGame from 'telegram/func/createGame'

const array = [
  {
    prop: 'name',
    message: 'Введите название игры',
    answerMessage: (answer) => `Задано название игры "${answer}"`,
    buttons: (jsonCommand) => [
      { cmd: 'menu_games_edit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'description',
    message: 'Введите описание игры',
    answerMessage: (answer) => `Задано описание игры "${answer}"`,
    buttons: (jsonCommand) => [
      { cmd: 'menu_games_edit', text: '\u{1F6AB} Отмена создания игры' },
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
    buttons: (jsonCommand) => [
      {
        cmd: { dateStart: null },
        // 'create_game' + propsToStr(props) + '/dateStart=null'
        text: 'Без описания',
      },
      { cmd: 'menu_games_edit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
]

const create_game = async ({ telegramId, jsonCommand }) => {
  // Если это запрос (команда), то отправляем текст пользователю
  if (!jsonCommand.message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (jsonCommand[data.prop] === undefined) {
        return {
          success: true,
          message: data.message,
          buttons: data.buttons(jsonCommand),
          // nextCommand: `/menu_teams`,
        }
      }
    }
  }

  // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (jsonCommand[data.prop] === undefined) {
      if (
        array[i].checkAnswer !== undefined &&
        !array[i].checkAnswer(jsonCommand.message)
      ) {
        return {
          success: false,
          message: array[i].errorMessage(jsonCommand.message),
          // buttons: data.buttons(props),
          nextCommand: jsonCommand,
          // `/create_game` + propsToStr(props),
        }
      }
      if (i < array.length - 1)
        return {
          success: true,
          message: array[i].answerMessage(jsonCommand.message),
          // buttons: data.buttons(props),
          nextCommand: { [data.prop]: jsonCommand.message },
          // `/create_game` + propsToStr(props),
        }
    }
  }

  // Если все переменные на месте, то создаем команду
  const game = await createGame(telegramId, jsonCommand)

  return {
    success: true,
    message: `Игра "${jsonCommand.name}" создана`,
    nextCommand: `menu_games_edit`,
  }
}

export default create_game
