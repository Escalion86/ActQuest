import createGameFunc from 'telegram/func/createGameFunc'
import moment from 'moment-timezone'

const array = [
  {
    prop: 'name',
    message: 'Введите название игры',
    answerMessage: (answer) => `Задано название игры: "${answer}"`,
    buttons: (jsonCommand) => [
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'description',
    message: 'Введите описание игры',
    answerMessage: (answer) => `Задано описание игры: "${answer}"`,
    buttons: (jsonCommand) => [
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
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
        c: { dateStart: null },
        // 'createGame' + propsToStr(props) + '/dateStart=null'
        text: 'Без даты',
      },
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
    answerConverter: (answer) => {
      const [date, time] = answer.split(' ')
      const [day, month, year] = date.split('.')
      const [hours, minutes] = time.split(':')
      return moment.tz(
        `${year}-${month}-${day} ${hours}:${minutes}`,
        'Asia/Krasnoyarsk'
      )
    },
  },
  {
    prop: 'image',
    message: 'Отправьте картинку анонса',
    answerMessage: (answer) => `Картинка анонса загружена`,
    buttons: (jsonCommand) => [
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
]

const createGame = async ({ telegramId, jsonCommand }) => {
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
      if (
        array[i].checkAnswer !== undefined &&
        !array[i].checkAnswer(jsonCommand.message)
      ) {
        return {
          success: false,
          message: array[i].errorMessage(jsonCommand.message),
          // buttons: data.buttons(props),
          nextCommand: jsonCommand,
          // `/createGame` + propsToStr(props),
        }
      }

      const value =
        typeof array[i].answerConverter === 'function'
          ? array[i].answerConverter(jsonCommand.message)
          : jsonCommand.message

      if (i < array.length - 1) {
        return {
          success: true,
          message: array[i].answerMessage(jsonCommand.message),
          // buttons: data.buttons(props),
          nextCommand: { [data.prop]: value },
          // `/createGame` + propsToStr(props),
        }
      } else {
        jsonCommand[data.prop] = value
      }
    }
  }

  // Если все переменные на месте, то создаем команду
  const game = await createGameFunc(telegramId, jsonCommand)

  return {
    success: true,
    message: `Игра "${jsonCommand.name}" создана`,
    nextCommand: `menuGamesEdit`,
  }
}

export default createGame
