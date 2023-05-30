import formatDateTime from '@helpers/formatDateTime'
import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import moment from 'moment-timezone'
import check from 'telegram/func/check'

const checkAnswer = (answer) =>
  // '^(?:(?:31(/|-|.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(/|-|.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]d)?d{2})$|^(?:29(/|-|.)0?2\3(?:(?:(?:1[6-9]|[2-9]d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1d|2[0-8])(/|-|.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]d)?d{2})$'.test(
  /^([1-9]|([012][0-9])|(3[01]))\.([0]{0,1}[1-9]|1[012])\.\d\d\d\d\s([0-1]?[0-9]|2?[0-3]):([0-5]\d)$/.test(
    answer
  )

const setGameDate = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новые дату и время игры в формате "dd.MM.yyyy hh:mm"',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          cmd: { cmd: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const answer = jsonCommand.message

  if (!checkAnswer(answer)) {
    return {
      success: true,
      message:
        'Дата и время заданы в неверном формате. Формат даты и времени должен соответствовать "dd.MM.yyyy hh:mm"',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          cmd: { cmd: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const [date, time] = answer.split(' ')
  const [day, month, year] = date.split('.')
  const [hours, minutes] = time.split(':')
  const dateStart = moment.tz(
    `${year}-${month}-${day} ${hours}:${minutes}`,
    'Asia/Krasnoyarsk'
  )

  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    dateStart,
  })

  return {
    success: true,
    message: `Дата игры обновлена на "${moment(dateStart)
      .tz('Asia/Krasnoyarsk')
      .format('DD.MM.yyyy H:mm')}"`,
    nextCommand: { cmd: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameDate
