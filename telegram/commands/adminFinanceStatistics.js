import isUserAdmin from '@helpers/isUserAdmin'
import { joinLines, joinSections } from 'telegram/func/messageFormatting'

const formatAmount = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace('.', ',')
}

const formatCurrency = (value) => `${formatAmount(value)} руб.`

const escapeForPre = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const sanitizeCell = (value) =>
  String(value ?? '')
    .replace(/&/g, '＆')
    .replace(/</g, '‹')
    .replace(/>/g, '›')

const buildTable = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  const safeRows = rows.map((row) => row.map(sanitizeCell))

  const columnWidths = safeRows[0].map((_, columnIndex) =>
    safeRows.reduce((max, row) => {
      const cellLength = String(row[columnIndex] ?? '').length
      return Math.max(max, cellLength)
    }, 0)
  )

  const formattedRows = safeRows.map((row) =>
    row
      .map((cell, columnIndex) => String(cell ?? '').padEnd(columnWidths[columnIndex], ' '))
      .join(' | ')
  )

  return `<pre>${escapeForPre(formattedRows.join('\n'))}</pre>`
}

const adminFinanceStatistics = async ({ user, db }) => {
  if (!isUserAdmin(user)) {
    return {
      success: false,
      message: 'Недостаточно прав для просмотра финансовой статистики.',
    }
  }

  const games = await db
    .model('Games')
    .find({})
    .select({ _id: 1, name: 1, finances: 1 })
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

  const paymentsByGame = payments.reduce((acc, payment) => {
    const paymentGameId = String(payment?.gameId ?? '')
    if (!paymentGameId) return acc
    const sum = Number(payment?.sum) || 0
    acc[paymentGameId] = (acc[paymentGameId] || 0) + sum
    return acc
  }, {})

  const statistics = games
    .map((game) => {
      const finances = Array.isArray(game.finances) ? game.finances : []

      const otherIncome = finances
        .filter(({ type }) => type === 'income')
        .reduce((acc, { sum }) => acc + (Number(sum) || 0), 0)

      const expenses = finances
        .filter(({ type }) => type === 'expense')
        .reduce((acc, { sum }) => acc + (Number(sum) || 0), 0)

      const playerIncome = paymentsByGame[String(game._id)] || 0

      const total = playerIncome + otherIncome - expenses

      return {
        name: game.name || 'Без названия',
        playerIncome,
        otherIncome,
        expenses,
        total,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const tableRows = [
    ['Игра', 'Поступление от игроков', 'Прочие поступления', 'Расходы', 'ИТОГО'],
    ...statistics.map(({ name, playerIncome, otherIncome, expenses, total }) => [
      name,
      formatCurrency(playerIncome),
      formatCurrency(otherIncome),
      formatCurrency(expenses),
      formatCurrency(total),
    ]),
  ]

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

  tableRows.push([
    'ИТОГО',
    formatCurrency(totals.playerIncome),
    formatCurrency(totals.otherIncome),
    formatCurrency(totals.expenses),
    formatCurrency(totals.total),
  ])

  const headerLines = ['<b>Финансовая статистика</b>', 'Поступления и расходы по играм']

  const tableSection = buildTable(tableRows)

  const messageSections = [joinLines(headerLines)]

  if (tableSection) {
    messageSections.push(tableSection)
  }

  return {
    message: joinSections(messageSections),
    buttons: [{ c: 'adminMenu', text: '\u{2B05} Назад' }],
  }
}

export default adminFinanceStatistics
