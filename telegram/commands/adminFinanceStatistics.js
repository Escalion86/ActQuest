import moment from 'moment-timezone'
import isUserAdmin from '@helpers/isUserAdmin'
import { joinLines, joinSections } from 'telegram/func/messageFormatting'

const TIMEZONE = 'Asia/Krasnoyarsk'
const MONTHS_LOWER = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

const formatAmount = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace('.', ',')
}

const formatCurrency = (value) => `${formatAmount(value)} руб.`

const chunkButtons = (buttons, size = 3) => {
  const result = []
  let chunk = []

  buttons.forEach((button) => {
    chunk.push(button)
    if (chunk.length === size) {
      result.push(chunk)
      chunk = []
    }
  })

  if (chunk.length > 0) {
    result.push(chunk)
  }

  return result
}

const clampYear = (value, min, max) => {
  if (value === undefined || value === null) {
    return undefined
  }
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}


const buildCommand = (state, overrides = {}) => {
  const command = { c: 'adminFinanceStatistics' }
  const merged = {
    startYear: state.startYear,
    startMonth: state.startMonth,
    endYear: state.endYear,
    endMonth: state.endMonth,
    startPickerYear: state.startPickerYear,
    endPickerYear: state.endPickerYear,
    ...overrides,
  }

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      command[key] = value
    }
  })

  return command
}

const buildMonthYearSelection = ({
  headerTitle,
  prompt,
  state,
  pickerYear,
  pickerYearKey,
  selectionYearKey,
  selectionMonthKey,
  allowedYears,
  allowedMonths,
}) => {
  const headerLines = ['<b>Финансовая статистика</b>', headerTitle]
  const messageSections = [joinLines(headerLines), joinLines([prompt])]

  const buttons = chunkButtons(
    allowedMonths.map((month) => ({
      text: `${MONTHS_LOWER[month - 1]} ${pickerYear}`,
      c: buildCommand(state, {
        [selectionYearKey]: pickerYear,
        [selectionMonthKey]: month,
        [pickerYearKey]: pickerYear,
      }),
    })),
    3
  )

  const navigationRow = []
  if (allowedYears.some((year) => year < pickerYear)) {
    navigationRow.push({
      text: '⬅️',
      c: buildCommand(state, { [pickerYearKey]: pickerYear - 1 }),
    })
  }
  if (allowedYears.some((year) => year > pickerYear)) {
    navigationRow.push({
      text: '➡️',
      c: buildCommand(state, { [pickerYearKey]: pickerYear + 1 }),
    })
  }

  if (navigationRow.length > 0) {
    buttons.push(navigationRow)
  }

  buttons.push([{ c: 'adminMenu', text: '⬅️ Назад' }])

  return {
    message: joinSections(messageSections),
    buttons,
  }
}

const formatGameDate = (game) => {
  const date = game?.dateStart || game?.dateStartFact || game?.dateEndFact
  if (!date) {
    return 'Без даты'
  }
  return moment(date).tz(TIMEZONE).format('DD.MM.YYYY')
}

const adminFinanceStatistics = async ({ user, db, jsonCommand = {} }) => {
  if (!isUserAdmin(user)) {
    return {
      success: false,
      message: 'Недостаточно прав для просмотра финансовой статистики.',
    }
  }

  const state = {
    startYear:
      jsonCommand.startYear !== undefined ? Number(jsonCommand.startYear) : undefined,
    startMonth:
      jsonCommand.startMonth !== undefined
        ? Number(jsonCommand.startMonth)
        : undefined,
    endYear:
      jsonCommand.endYear !== undefined ? Number(jsonCommand.endYear) : undefined,
    endMonth:
      jsonCommand.endMonth !== undefined ? Number(jsonCommand.endMonth) : undefined,
    startPickerYear:
      jsonCommand.startPickerYear !== undefined
        ? Number(jsonCommand.startPickerYear)
        : undefined,
    endPickerYear:
      jsonCommand.endPickerYear !== undefined ? Number(jsonCommand.endPickerYear) : undefined,
  }

  const games = await db
    .model('Games')
    .find({})
    .select({ _id: 1, name: 1, finances: 1, dateStart: 1, dateStartFact: 1, dateEndFact: 1 })
    .lean()

  if (!games || games.length === 0) {
    const messageSections = [
      joinLines(['<b>Финансовая статистика</b>', 'Игры отсутствуют.']),
    ]

    return {
      message: joinSections(messageSections),
      buttons: [{ c: 'adminMenu', text: '\u{2B05} Назад' }],
    }
  }

  const gameIds = games.map((game) => String(game._id))

  const payments = await db
    .model('UsersGamesPayments')
    .find({ gameId: { $in: gameIds } })
    .lean()

  const allDates = []

  payments.forEach((payment) => {
    if (payment?.createdAt) {
      allDates.push(moment(payment.createdAt))
    }
  })

  games.forEach((game) => {
    const finances = Array.isArray(game.finances) ? game.finances : []
    finances.forEach((finance) => {
      if (finance?.date) {
        allDates.push(moment(finance.date))
      }
    })
  })

  const now = moment().tz(TIMEZONE)

  const gameYears = Array.from(
    new Set(
      games
        .flatMap((game) =>
          [game.dateStart, game.dateStartFact, game.dateEndFact].filter(Boolean)
        )
        .map((date) => moment(date).tz(TIMEZONE).year())
    )
  ).sort((a, b) => a - b)

  const transactionYears = allDates.length
    ? Array.from(new Set(allDates.map((date) => date.tz(TIMEZONE).year()))).sort(
        (a, b) => a - b
      )
    : []

  const years =
    gameYears.length > 0
      ? gameYears
      : transactionYears.length > 0
      ? transactionYears
      : [now.year()]

  const minYear = years[0]
  const maxYear = years[years.length - 1]

  const startPickerFromState = clampYear(state.startPickerYear, minYear, maxYear)
  const startPickerFallback = clampYear(state.startYear, minYear, maxYear) ?? maxYear
  state.startPickerYear = startPickerFromState ?? startPickerFallback

  if (state.startYear === undefined || state.startMonth === undefined) {
    return buildMonthYearSelection({
      headerTitle: 'Выбор периода',
      prompt: 'С какого месяца нужна статистика?',
      state,
      pickerYear: state.startPickerYear,
      pickerYearKey: 'startPickerYear',
      selectionYearKey: 'startYear',
      selectionMonthKey: 'startMonth',
      allowedYears: years,
      allowedMonths: Array.from({ length: 12 }, (_, index) => index + 1),
    })
  }

  state.startYear = clampYear(state.startYear, minYear, maxYear)
  state.startMonth = Math.min(Math.max(state.startMonth, 1), 12)

  let allowedEndYears = years.filter((year) => year >= state.startYear)
  if (allowedEndYears.length === 0) {
    allowedEndYears = [state.startYear]
  }
  const endMinYear = allowedEndYears[0]
  const endMaxYear = allowedEndYears[allowedEndYears.length - 1]

  if (state.endYear !== undefined && state.endMonth !== undefined) {
    const startMomentCheck = moment
      .tz({ year: state.startYear, month: state.startMonth - 1 }, TIMEZONE)
      .startOf('month')
    const endMomentCheck = moment
      .tz({ year: state.endYear, month: state.endMonth - 1 }, TIMEZONE)
      .endOf('month')
    if (endMomentCheck.isBefore(startMomentCheck)) {
      state.endYear = undefined
      state.endMonth = undefined
      state.endPickerYear = undefined
    }
  }

  const endPickerFromState = clampYear(state.endPickerYear, endMinYear, endMaxYear)
  const endPickerFallback = (
    clampYear(state.endYear, endMinYear, endMaxYear) ??
    state.startYear ??
    endMinYear
  )
  state.endPickerYear = endPickerFromState ?? endPickerFallback

  if (state.endYear === undefined || state.endMonth === undefined) {
    const allowedMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter(
      (month) => {
        if (state.endPickerYear === state.startYear) {
          return month >= state.startMonth
        }
        return true
      }
    )

    return buildMonthYearSelection({
      headerTitle: 'Выбор периода',
      prompt: 'До какого месяца нужна статистика?',
      state,
      pickerYear: state.endPickerYear,
      pickerYearKey: 'endPickerYear',
      selectionYearKey: 'endYear',
      selectionMonthKey: 'endMonth',
      allowedYears: allowedEndYears,
      allowedMonths,
    })
  }

  state.endYear = clampYear(state.endYear, state.startYear, endMaxYear)
  state.endMonth = Math.min(Math.max(state.endMonth, 1), 12)

  const startMoment = moment
    .tz({ year: state.startYear, month: state.startMonth - 1 }, TIMEZONE)
    .startOf('month')
  const endMoment = moment
    .tz({ year: state.endYear, month: state.endMonth - 1 }, TIMEZONE)
    .endOf('month')

  const paymentsByGame = payments.reduce((acc, payment) => {
    const paymentGameId = String(payment?.gameId ?? '')
    if (!paymentGameId) return acc
    const sum = Number(payment?.sum) || 0
    const createdAt = payment?.createdAt ? moment(payment.createdAt).tz(TIMEZONE) : null
    if (!createdAt) return acc
    if (createdAt.isBefore(startMoment) || createdAt.isAfter(endMoment)) {
      return acc
    }
    acc[paymentGameId] = (acc[paymentGameId] || 0) + sum
    return acc
  }, {})

  const statistics = games
    .map((game) => {
      const finances = Array.isArray(game.finances) ? game.finances : []

      const otherIncome = finances
        .filter(({ type }) => type === 'income')
        .reduce((acc, { sum, date }) => {
          if (!date) return acc
          const financeDate = moment(date).tz(TIMEZONE)
          if (financeDate.isBefore(startMoment) || financeDate.isAfter(endMoment)) {
            return acc
          }
          return acc + (Number(sum) || 0)
        }, 0)

      const expenses = finances
        .filter(({ type }) => type === 'expense')
        .reduce((acc, { sum, date }) => {
          if (!date) return acc
          const financeDate = moment(date).tz(TIMEZONE)
          if (financeDate.isBefore(startMoment) || financeDate.isAfter(endMoment)) {
            return acc
          }
          return acc + (Number(sum) || 0)
        }, 0)

      const playerIncome = paymentsByGame[String(game._id)] || 0

      const total = playerIncome + otherIncome - expenses

      return {
        name: game.name || 'Без названия',
        date: formatGameDate(game),
        playerIncome,
        otherIncome,
        expenses,
        total,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totals = statistics.reduce(
    (acc, item) => {
      acc.playerIncome += item.playerIncome
      acc.otherIncome += item.otherIncome
      acc.expenses += item.expenses
      acc.total += item.total
      return acc
    },
    { playerIncome: 0, otherIncome: 0, expenses: 0, total: 0 }
  )

  const startPeriodText = startMoment.format('MM.YYYY')
  const endPeriodText = endMoment.format('MM.YYYY')

  const headerLines = [
    '<b>Финансовая статистика</b>',
    `<b>Период:</b> ${startPeriodText} – ${endPeriodText}`,
  ]

  const messageSections = [joinLines(headerLines)]

  statistics.forEach(({ name, date, playerIncome, otherIncome, expenses, total }) => {
    const gameLines = [
      `<b>${name}, ${date}</b>`,
      `\u{2795}\u{1F465} Поступления от игроков: ${formatCurrency(playerIncome)}`,
      `\u{2795} Прочие поступления: ${formatCurrency(otherIncome)}`,
      `\u{2796} Расходы: ${formatCurrency(expenses)}`,
      `\u{1F4B0} <b>Итого: ${formatCurrency(total)}</b>`,
    ]

    messageSections.push(joinLines(gameLines))
  })

  const totalsLines = [
    '<b>ИТОГО ПО ПЕРИОДУ</b>',
    `\u{2795}\u{1F465} Поступления от игроков: ${formatCurrency(totals.playerIncome)}`,
    `\u{2795} Прочие поступления: ${formatCurrency(totals.otherIncome)}`,
    `\u{2796} Расходы: ${formatCurrency(totals.expenses)}`,
    `\u{1F4B0} <b>Итого: ${formatCurrency(totals.total)}</b>`,
  ]

  messageSections.push(joinLines(totalsLines))

  const buttons = [
    { text: '\u{1F4C5} Выбрать другой период', c: { c: 'adminFinanceStatistics' } },
    { c: 'adminMenu', text: '\u{2B05} Назад' },
  ]

  return {
    message: joinSections(messageSections),
    buttons,
  }
}

export default adminFinanceStatistics
