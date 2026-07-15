const toStringId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue === '[object Object]' ? '' : stringValue.trim()
  }
  return ''
}

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export const buildGameTeamPaymentsSummary = ({
  gameTeams = [],
  teams = [],
  paymentTotals = [],
} = {}) => {
  const teamsById = new Map(
    (Array.isArray(teams) ? teams : [])
      .map((team) => [toStringId(team?._id ?? team?.id), team])
      .filter(([teamId]) => Boolean(teamId)),
  )
  const paymentsByGameTeamId = new Map()

  for (const item of Array.isArray(paymentTotals) ? paymentTotals : []) {
    const groupId = item?._id
    const gameTeamId = toStringId(
      groupId && typeof groupId === 'object'
        ? groupId.gameTeamId
        : item?.gameTeamId ?? groupId,
    )
    if (!gameTeamId) continue

    const userId = toStringId(
      groupId && typeof groupId === 'object' ? groupId.userId : item?.userId,
    )
    const totalPaid = Math.max(0, toNumber(item?.totalPaid, 0))
    const totalDiscount = Math.max(0, toNumber(item?.totalDiscount, 0))
    const totalCredited = Math.max(
      0,
      toNumber(item?.totalCredited, totalPaid + totalDiscount),
    )
    const transactionsCount = Math.max(
      0,
      Math.floor(toNumber(item?.transactionsCount, 0)),
    )
    const current = paymentsByGameTeamId.get(gameTeamId) ?? {
      totalPaid: 0,
      totalDiscount: 0,
      totalCredited: 0,
      transactionsCount: 0,
      members: new Map(),
    }

    current.totalPaid += totalPaid
    current.totalDiscount += totalDiscount
    current.totalCredited += totalCredited
    current.transactionsCount += transactionsCount
    if (userId) {
      current.members.set(userId, {
        userId,
        totalPaid,
        totalDiscount,
        totalCredited,
        transactionsCount,
        isPaid: totalCredited > 0,
      })
    }
    paymentsByGameTeamId.set(gameTeamId, current)
  }

  const entries = (Array.isArray(gameTeams) ? gameTeams : [])
    .map((gameTeam) => {
      const gameTeamId = toStringId(gameTeam?._id ?? gameTeam?.id)
      const teamId = toStringId(gameTeam?.teamId)
      if (!gameTeamId || !teamId) return null

      const team = teamsById.get(teamId)
      const payment = paymentsByGameTeamId.get(gameTeamId) ?? {
        totalPaid: 0,
        totalDiscount: 0,
        totalCredited: 0,
        transactionsCount: 0,
        members: new Map(),
      }
      const members = Array.isArray(team?.members) ? team.members : []
      const memberPayments = members
        .map((member) => {
          const userId = toStringId(member?.userId ?? member?.user?._id)
          if (!userId) return null
          return (
            payment.members.get(userId) ?? {
              userId,
              totalPaid: 0,
              totalDiscount: 0,
              totalCredited: 0,
              transactionsCount: 0,
              isPaid: false,
            }
          )
        })
        .filter(Boolean)

      return {
        gameTeamId,
        teamId,
        teamName:
          typeof team?.name === 'string' && team.name.trim()
            ? team.name.trim()
            : 'Без названия',
        paidGame: Boolean(gameTeam?.paidGame),
        totalPaid: payment.totalPaid,
        totalDiscount: payment.totalDiscount,
        totalCredited: payment.totalCredited,
        transactionsCount: payment.transactionsCount,
        members,
        memberPayments,
      }
    })
    .filter(Boolean)
    .sort((first, second) =>
      String(first.teamName || '').localeCompare(
        String(second.teamName || ''),
        'ru',
      ),
    )

  return {
    totalPaid: entries.reduce((sum, item) => sum + item.totalPaid, 0),
    totalDiscount: entries.reduce(
      (sum, item) => sum + item.totalDiscount,
      0,
    ),
    totalCredited: entries.reduce(
      (sum, item) => sum + item.totalCredited,
      0,
    ),
    teams: entries,
  }
}
