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
  const paymentsByGameTeamId = new Map(
    (Array.isArray(paymentTotals) ? paymentTotals : [])
      .map((item) => [
        toStringId(item?._id ?? item?.gameTeamId),
        {
          totalPaid: Math.max(0, toNumber(item?.totalPaid, 0)),
          transactionsCount: Math.max(
            0,
            Math.floor(toNumber(item?.transactionsCount, 0)),
          ),
        },
      ])
      .filter(([gameTeamId]) => Boolean(gameTeamId)),
  )

  const entries = (Array.isArray(gameTeams) ? gameTeams : [])
    .map((gameTeam) => {
      const gameTeamId = toStringId(gameTeam?._id ?? gameTeam?.id)
      const teamId = toStringId(gameTeam?.teamId)
      if (!gameTeamId || !teamId) return null

      const team = teamsById.get(teamId)
      const payment = paymentsByGameTeamId.get(gameTeamId) ?? {
        totalPaid: 0,
        transactionsCount: 0,
      }

      return {
        gameTeamId,
        teamId,
        teamName:
          typeof team?.name === 'string' && team.name.trim()
            ? team.name.trim()
            : 'Без названия',
        paidGame: Boolean(gameTeam?.paidGame),
        totalPaid: payment.totalPaid,
        transactionsCount: payment.transactionsCount,
        members: Array.isArray(team?.members) ? team.members : [],
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
    teams: entries,
  }
}
