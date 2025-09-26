import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import moment from 'moment-timezone'

import { joinLines, joinSections, newline } from 'telegram/func/messageFormatting'


const formatAmount = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace('.', ',')
}

const formatDate = (value) => {
  if (!value) return '[без даты]'
  const date = moment(value)
  if (!date.isValid()) {
    return '[неверная дата]'
  }
  return date.tz('Asia/Krasnoyarsk').format('DD.MM.YYYY')
}

const editGameFinances = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const finances = Array.isArray(game.finances) ? game.finances : []
  const sortedFinances = [...finances].sort((a, b) => {
    const dateA = a?.date ? new Date(a.date).getTime() : 0
    const dateB = b?.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })

  const totalIncome = sortedFinances
    .filter(({ type }) => type === 'income')
    .reduce((acc, { sum }) => acc + (Number(sum) || 0), 0)
  const totalExpense = sortedFinances
    .filter(({ type }) => type === 'expense')
    .reduce((acc, { sum }) => acc + (Number(sum) || 0), 0)
  const balance = totalIncome - totalExpense

  const pageFromCommandRaw = Number(jsonCommand?.page ?? 1)
  const pageFromCommand = Number.isFinite(pageFromCommandRaw)
    ? pageFromCommandRaw
    : 1
  const perPage = 10
  const totalPages = Math.max(1, Math.ceil(sortedFinances.length / perPage))
  const currentPage = Math.min(Math.max(pageFromCommand, 1), totalPages)
  const startIndex = (currentPage - 1) * perPage
  const visibleFinances = sortedFinances.slice(startIndex, startIndex + perPage)

  const transactionsText =
    visibleFinances.length > 0
      ? visibleFinances
          .map(({ date, type, sum, description }) => {
            const sign = type === 'income' ? '\u2795' : '\u2796'
            const typeName = type === 'income' ? 'Доход' : 'Расход'
            const descriptionText = description ? ` — ${description}` : ''
            return `${sign} ${formatDate(date)} · ${typeName}: ${formatAmount(
              Number(sum) || 0
            )} руб.${descriptionText}`
          })
          .join(newline)
      : 'Транзакций пока нет.'

  const paginationLines =
    totalPages > 1 ? [`Страница ${currentPage} из ${totalPages}`] : []

  const buttons = []
  const navigationRow = []
  if (currentPage > 1) {
    navigationRow.push({
      c: { c: 'editGameFinances', gameId: jsonCommand.gameId, page: currentPage - 1 },
      text: '\u2B05\uFE0F Назад',
    })
  }
  if (currentPage < totalPages) {
    navigationRow.push({
      c: { c: 'editGameFinances', gameId: jsonCommand.gameId, page: currentPage + 1 },
      text: 'Вперед \u27A1\uFE0F',
    })
  }
  if (navigationRow.length > 0) {
    buttons.push(navigationRow)
  }

  buttons.push([
    {
      c: { c: 'addGameFinance', gameId: jsonCommand.gameId, financeType: 'income' },
      text: '➕ Добавить доход',
    },
    {
      c: { c: 'addGameFinance', gameId: jsonCommand.gameId, financeType: 'expense' },
      text: '➖ Добавить расход',
    },
  ])

  buttons.push({ c: { c: 'editGame', gameId: jsonCommand.gameId }, text: '⬅ Назад' })

  const headerLines = [
    `<b>Финансы игры "${game?.name}"</b>`,
    `<b>Доходы</b>: ${formatAmount(totalIncome)} руб.`,
    `<b>Расходы</b>: ${formatAmount(totalExpense)} руб.`,
    `<b>Баланс</b>: ${formatAmount(balance)} руб.`,
  ]

  const messageSections = [
    joinLines(headerLines),
    joinLines([transactionsText]),
    joinLines(paginationLines),
  ]

  return {
    message: joinSections(messageSections),
    buttons,
  }
}

export default editGameFinances
