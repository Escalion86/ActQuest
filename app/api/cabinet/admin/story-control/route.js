import { NextResponse } from 'next/server'

import {
  buildAdminStoryTeamPayload,
  ensureStoryProgress,
  loadAdminStoryContext,
  normalizeStringId,
} from '@app/api/cabinet/_lib/storyApi'

const normalizeText = (value) =>
  typeof value === 'string'
    ? value.trim()
    : Number.isFinite(value)
      ? String(value).trim()
      : ''

const buildAdminGamePayload = (game) => ({
  id: normalizeStringId(game?._id ?? game?.id),
  name: normalizeText(game?.name),
  status: normalizeText(game?.status),
  type: normalizeText(game?.type),
  storyConfig: game?.storyConfig || {},
  storyItems: Array.isArray(game?.storyItems) ? game.storyItems : [],
  storyNodes: Array.isArray(game?.storyNodes) ? game.storyNodes : [],
  storyEdges: Array.isArray(game?.storyEdges) ? game.storyEdges : [],
  storyEndings: Array.isArray(game?.storyEndings) ? game.storyEndings : [],
  storyCharacters: Array.isArray(game?.storyCharacters)
    ? game.storyCharacters
    : [],
  storyTopics: Array.isArray(game?.storyTopics) ? game.storyTopics : [],
  storyInteractions: Array.isArray(game?.storyInteractions)
    ? game.storyInteractions
    : [],
  storyEvidence: Array.isArray(game?.storyEvidence) ? game.storyEvidence : [],
  storyAccusation: game?.storyAccusation || {},
})

export async function GET(request) {
  try {
    const context = await loadAdminStoryContext({ request })
    if (context.response) {
      return context.response
    }

    const gameId = normalizeStringId(context.game._id)
    const gameTeams = await context.GamesTeams.find({ gameId }).lean()
    const teamIds = gameTeams
      .map((gameTeam) => normalizeStringId(gameTeam?.teamId))
      .filter(Boolean)
    const teams = teamIds.length
      ? await context.Teams.find({ _id: { $in: teamIds } }).lean()
      : []
    const teamsById = new Map(
      teams.map((team) => [normalizeStringId(team?._id), team]),
    )

    const teamPayloads = await Promise.all(gameTeams.map(async (gameTeam) => {
      const shouldInitializeCommonProgress =
        context.game?.status === 'started' &&
        context.game?.storyConfig?.startMode !== 'individual'
      const progress = gameTeam?.storyProgress
        ? gameTeam.storyProgress
        : shouldInitializeCommonProgress
          ? await ensureStoryProgress({
              GamesTeams: context.GamesTeams,
              game: context.game,
              gameTeam,
              actor: 'admin',
              save: true,
            })
          : null
      const teamId = normalizeStringId(gameTeam?.teamId)
      return buildAdminStoryTeamPayload({
        game: context.game,
        team: teamsById.get(teamId),
        gameTeam,
        progress,
      })
    }))

    return NextResponse.json({
      success: true,
      data: {
        game: buildAdminGamePayload(context.game),
        teams: teamPayloads,
      },
    })
  } catch (error) {
    console.error('Failed to fetch story control', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить контроль story-квеста' },
      { status: 500 },
    )
  }
}
