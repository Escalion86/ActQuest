import arrayOfCommands from 'telegram/func/arrayOfCommands'
import check from 'telegram/func/check'
import moment from 'moment-timezone'
import { v4 as uuidv4 } from 'uuid'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editGameFinances', gameId: jsonCommand.gameId },
  text: '\u{1F6AB} Отмена добавления транзакции',
})

const formatAmount = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace('.', ',')
}

const parseAmount = (value) => {
  const prepared = String(value).replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(prepared)
  return Number.isFinite(parsed) ? parsed : NaN
}

const parseDate = (value) => {
  const trimmed = String(value).trim()
  const formats = ['DD.MM.YYYY', 'DD.MM.YY', 'DD.MM']
  for (const format of formats) {
    const date = moment(trimmed, format, true)
    if (date.isValid()) {
      if (format === 'DD.MM') {
        const now = moment()
        date.year(now.year())
      }
      if (format === 'DD.MM.YY') {
        const year = date.year()
        date.year(year < 100 ? 2000 + year : year)
      }
      return date.toDate()
    }
  }
  return null
}

const array = [
  {
    prop: 'sum',
    message: 'Введите сумму транзакции в рублях',
    checkAnswer: (answer) => {
      const value = parseAmount(answer)
      return !Number.isNaN(value) && value > 0
    },
    errorMessage: () => 'Сумма должна быть положительным числом.',
    answerMessage: (answer) => {
      const value = parseAmount(answer)
      return `Сумма: ${formatAmount(value)} руб.`
    },
    answerConverter: (answer) => parseAmount(answer),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'date',
    message: 'Введите дату транзакции в формате ДД.ММ.ГГГГ',
    checkAnswer: (answer) => parseDate(answer) !== null,
    errorMessage: () => 'Дата должна быть в формате ДД.ММ.ГГГГ.',
    answerMessage: (answer) => {
      const date = moment(parseDate(answer)).tz('Asia/Krasnoyarsk')
      return `Дата: ${date.format('DD.MM.YYYY')}`
    },
    answerConverter: (answer) => parseDate(answer),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'description',
    message: 'Введите описание транзакции',
    checkAnswer: (answer) => String(answer).trim().length > 0,
    errorMessage: () => 'Описание не может быть пустым.',
    answerMessage: (answer) => `Описание: ${String(answer).trim()}`,
    answerConverter: (answer) => String(answer).trim(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addGameFinance = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId', 'financeType'])
  if (checkData) return checkData

  if (!['income', 'expense'].includes(jsonCommand.financeType)) {
    return {
      success: false,
      message: 'Неизвестный тип транзакции.',
      nextCommand: { c: 'editGameFinances', gameId: jsonCommand.gameId },
    }
  }

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const finance = {
        id: uuidv4(),
        type: jsonCommand.financeType,
        sum: result.sum,
        date: result.date,
        description: result.description,
      }

      await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
        $push: { finances: finance },
      })

      const typeName =
        jsonCommand.financeType === 'income' ? 'Доход' : 'Расход'

      return {
        success: true,
        message: `${typeName} на сумму ${formatAmount(result.sum)} руб. добавлен.`,
        nextCommand: {
          c: 'editGameFinances',
          gameId: jsonCommand.gameId,
        },
      }
    },
  })
}

export default addGameFinance
