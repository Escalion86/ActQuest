import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'

import fetchGame from '@server/fetchGame'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { authOptions } from '@server/auth/authOptions'
import GameEntryPageClient from '@components/location-game/GameEntryPageClient'

export const dynamic = 'force-dynamic'

export default async function GameEntryPage({ params }) {
  const locationParam = params?.location
  const gameIdParam = params?.id

  if (typeof locationParam !== 'string' || typeof gameIdParam !== 'string') {
    notFound()
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent(`/${locationParam}/game/${gameIdParam}`)}`,
    )
  }

  let payload
  try {
    const game = await fetchGame(locationParam, gameIdParam)
    if (!game || !game._id) {
      notFound()
    }

    const serializedGame = JSON.parse(JSON.stringify(game))
    const status = serializedGame.status || 'active'
    const isGameStarted = status === 'started'
    const isGameFinished = status === 'finished'

    const db = await dbConnectGlobal()
    if (!db) {
      payload = {
        session,
        location: locationParam,
        game: serializedGame,
        participantTeams: [],
        isParticipant: false,
        isGameStarted,
        isGameFinished,
        status,
        error: 'DB_CONNECTION_FAILED',
      }
    } else {
      const gamesTeams = await db.model('GamesTeams').find({ gameId: gameIdParam }).lean()
      const teamIds = Array.isArray(gamesTeams)
        ? gamesTeams.map((gameTeam) => gameTeam?.teamId).filter(Boolean)
        : []

      let isParticipant = false
      let participantTeams = []

      if (teamIds.length > 0 && session?.user?.telegramId) {
        const teamsUsers = await db.model('TeamsUsers').find({ teamId: { $in: teamIds } }).lean()
        const telegramId = String(session.user.telegramId)
        const memberships = teamsUsers.filter(
          (item) => String(item.userTelegramId) === telegramId,
        )

        if (memberships.length > 0) {
          isParticipant = true
          const membershipTeamIds = [
            ...new Set(
              memberships
                .map((item) => item.teamId)
                .filter(Boolean)
                .map((value) => String(value)),
            ),
          ]

          const teams = await db.model('Teams').find({ _id: { $in: membershipTeamIds } }).lean()
          participantTeams = teams
            .map((team) => {
              const id = String(team._id)
              const mappedTeam = gamesTeams.find((gameTeam) => String(gameTeam.teamId) === id)
              if (!mappedTeam) return null
              return {
                id,
                name: team.name || 'Команда без названия',
              }
            })
            .filter(Boolean)
        }
      }

      payload = {
        session,
        location: locationParam,
        game: serializedGame,
        participantTeams: JSON.parse(JSON.stringify(participantTeams)),
        isParticipant,
        isGameStarted,
        isGameFinished,
        status,
        error: null,
      }
    }
  } catch (error) {
    console.error('Game entry page error', error)
    payload = {
      session,
      location: locationParam,
      game: null,
      participantTeams: [],
      isParticipant: false,
      isGameStarted: false,
      isGameFinished: false,
      status: 'active',
      error: 'UNKNOWN_ERROR',
    }
  }

  return <GameEntryPageClient {...payload} />
}
