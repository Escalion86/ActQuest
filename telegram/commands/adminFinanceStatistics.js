import moment from 'moment-timezone'
import isUserAdmin from '@helpers/isUserAdmin'
import { joinLines, joinSections } from 'telegram/func/messageFormatting'

const TIMEZONE = 'Asia/Krasnoyarsk'
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
const INDENT = '&nbsp;&nbsp;'
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

const buildCommand = (state, overrides = {}) => {
  const command = { c: 'adminFinanceStatistics' }
  const merged = {
    startYear: state.startYear,
    startMonth: state.startMonth,
    endYear: state.endYear,
    endMonth: state.endMonth,
    ...overrides,
  }

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      command[key] = value
    }
  })

  return command
}

const buildYearSelection = ({
  headerTitle,
  prompt,
  years,
  state,
  overrideKey,
  filter = () => true,
}) => {
  const headerLines = ['<b>Финансовая статистика</b>', headerTitle]
  const messageSections = [joinLines(headerLines), joinLines([prompt])]

  const buttons = chunkButtons(
    years
      .filter(filter)
      .map((year) => ({
        text: `${year}`,
        c: buildCommand(state, { [overrideKey]: year }),
      })),
    3
  )

  buttons.push([{ c: 'adminMenu', text: '\u{2B05} Назад' }])

  return {
    message: joinSections(messageSections),
    buttons,
  }
}

const buildMonthSelection = ({
  headerTitle,
  prompt,
  state,
  overrideKey,
  allowedMonths,
}) => {
  const headerLines = ['<b>Финансовая статистика</b>', headerTitle]
  const messageSections = [
    joinLines(headerLines),
    joinLines([prompt]),
  ]

  const buttons = chunkButtons(
    allowedMonths.map((month) => ({
      text: `${MONTHS[month - 1]}`,
      c: buildCommand(state, { [overrideKey]: month }),
    })),
    3
  )

  buttons.push([{ c: 'adminMenu', text: '\u{2B05} Назад' }])

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
  const years = allDates.length
    ? Array.from(new Set(allDates.map((date) => date.tz(TIMEZONE).year()))).sort(
        (a, b) => a - b
      )
    : [now.year()]

  const minYear = years[0]
  const maxYear = years[years.length - 1]

  if (!state.startYear) {
    return buildYearSelection({
      headerTitle: 'Выбор периода',
      prompt: 'С какого года нужна статистика?',
      years,
      state,
      overrideKey: 'startYear',
    })
  }

  const clampedStartYear = Math.min(Math.max(state.startYear, minYear), maxYear)
  if (clampedStartYear !== state.startYear) {
    state.startYear = clampedStartYear
  }

  if (!state.startMonth) {
    return buildMonthSelection({
      headerTitle: 'Выбор периода',
      prompt: `Выбранный год начала: ${state.startYear}. Выберите месяц начала.`,
      state,
      overrideKey: 'startMonth',
      allowedMonths: Array.from({ length: 12 }, (_, index) => index + 1),
    })
  }

  if (!state.endYear) {
    return buildYearSelection({
      headerTitle: 'Выбор периода',
      prompt: 'До какого года нужна статистика?',
      years,
      state,
      overrideKey: 'endYear',
      filter: (year) => year >= state.startYear,
    })
  }

  const clampedEndYear = Math.min(Math.max(state.endYear, state.startYear), maxYear)
  if (clampedEndYear !== state.endYear) {
    state.endYear = clampedEndYear
  }

  if (!state.endMonth) {
    const months = Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => {
      if (state.endYear === state.startYear) {
        return month >= state.startMonth
      }
      return true
    })

    return buildMonthSelection({
      headerTitle: 'Выбор периода',
      prompt: `Выбранный год окончания: ${state.endYear}. Выберите месяц окончания.`,
      state,
      overrideKey: 'endMonth',
      allowedMonths: months,
    })
  }

  const startMoment = moment
    .tz({ year: state.startYear, month: state.startMonth - 1 }, TIMEZONE)
    .startOf('month')
  const endMoment = moment
    .tz({ year: state.endYear, month: state.endMonth - 1 }, TIMEZONE)
    .endOf('month')

  if (endMoment.isBefore(startMoment)) {
    return buildMonthSelection({
      headerTitle: 'Выбор периода',
      prompt: `Выбранный год окончания: ${state.endYear}. Выберите месяц окончания.`,
      state: { ...state, endMonth: undefined },
      overrideKey: 'endMonth',
      allowedMonths: Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => {
        if (state.endYear === state.startYear) {
          return month >= state.startMonth
        }
        return true
      }),
    })
  }

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
      `${INDENT}\u{2795}\u{1F465} Поступления от игроков: ${formatCurrency(
        playerIncome
      )}`,
      `${INDENT}\u{2795} Прочие поступления: ${formatCurrency(otherIncome)}`,
      `${INDENT}\u{2796} Расходы: ${formatCurrency(expenses)}`,
      `${INDENT}\u{1F4B0} <b>Итого: ${formatCurrency(total)}</b>`,
    ]

    messageSections.push(joinLines(gameLines))
  })

  const totalsLines = [
    '<b>ИТОГО ПО ПЕРИОДУ</b>',
    `${INDENT}\u{2795}\u{1F465} Поступления от игроков: ${formatCurrency(
      totals.playerIncome
    )}`,
    `${INDENT}\u{2795} Прочие поступления: ${formatCurrency(totals.otherIncome)}`,
    `${INDENT}\u{2796} Расходы: ${formatCurrency(totals.expenses)}`,
    `${INDENT}\u{1F4B0} <b>Итого: ${formatCurrency(totals.total)}</b>`,
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
