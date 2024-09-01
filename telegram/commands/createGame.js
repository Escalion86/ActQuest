import createGameFunc from 'telegram/func/createGameFunc'
import moment from 'moment-timezone'
import { getNounTasks } from '@helpers/getNoun'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

const array = [
  {
    prop: 'type',
    message:
      'Выберите тип игры:\n\u{1F697} Классика - в качестве ответа на задание должен быть какой-либо текст. Побеждает та команда, которая выполнит задания быстрее всех с учетом бонусов и штрафов по времени\n\u{1F4F7} Фотоквест - в качестве ответа на задание должно быть изображение. За каждое выполненное, а также дополнительные задания начисляются баллы. Побеждает команда набравшая больше всех баллов',
    answerMessage: (answer) =>
      `Задан тип игры "${
        answer === 'photo' ? '\u{1F4F7} Фотоквест' : '\u{1F697} Классика'
      }"`,
    buttons: (jsonCommand) => [
      {
        c: { type: 'classic' },
        text: '\u{1F697} Классика',
      },
      {
        c: { type: 'photo' },
        text: '\u{1F4F7} Фотоквест',
      },
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'name',
    message: 'Введите название игры (не должно превышать 50 символов)',
    checkAnswer: (answer) =>
      // '^(?:(?:31(/|-|.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(/|-|.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]d)?d{2})$|^(?:29(/|-|.)0?2\3(?:(?:(?:1[6-9]|[2-9]d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1d|2[0-8])(/|-|.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]d)?d{2})$'.test(
      /^.{2,51}$/.test(answer),
    errorMessage: (answer) =>
      `Название не должно превышать 50 символов. Попробуйте ещё раз`,
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
    message: 'Отправьте картинку анонса (со сжатием, тоесть НЕ файлом)',
    answerMessage: (answer) => `Картинка анонса загружена`,
    checkAnswer: (answer, isPhoto) => isPhoto,
    errorMessage: (answer) =>
      `Вы не отправили картинку анонса. Попробуйте ещё раз`,
    buttons: (jsonCommand) => [
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
  },
  {
    prop: 'tasks',
    message: 'Сколько заданий будет на игре?\nВведите число от 1 до 20',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum <= 20 && answerNum > 0
    },
    errorMessage: (answer) =>
      `Количество заданий должно быть в числовом формате, быть больше 0 и не превышать 20`,
    answerMessage: (answer) => `На игре будет ${getNounTasks(answer)} заданий`,
    buttons: (jsonCommand) => [
      { c: 'menuGamesEdit', text: '\u{1F6AB} Отмена создания игры' },
    ],
    answerConverter: (answer) => {
      const answerNum = Number(answer)
      const tasks = Array.from({ length: answerNum }, () => ({
        title: '[без названия]',
        task: '',
        clues: [],
        images: [],
        codes: [],
        numCodesToCompliteTask: null,
      }))
      return tasks
    },
  },
]

const createGame = async ({ telegramId, jsonCommand }) => {
  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const game = await createGameFunc(telegramId, result)

      return {
        success: true,
        message: `Игра "${result.name}" создана`,
        nextCommand: `menuGamesEdit`,
      }
    },
  })
}

export default createGame
