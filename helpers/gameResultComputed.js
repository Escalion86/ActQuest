export const getAllComputedResultTeams = (computed) => [
  ...(Array.isArray(computed?.teams) ? computed.teams : []),
  ...(Array.isArray(computed?.outOfCompetitionTeams)
    ? computed.outOfCompetitionTeams
    : []),
]
