import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'

import fetchGame from '@server/fetchGame'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { authOptions } from '@server/auth/authOptions'
import GameEntryPageClient from '@components/location-game/GameEntryPageClient'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const gameIdParam = resolvedParams?.id
  if (typeof gameIdParam !== 'string') {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  try {
    const { location } = await resolveGameLocationById(gameIdParam)
    if (!location) return {}

    const game = await fetchGame(location, gameIdParam)
    if (!game?.name) return {}

    const title = game.name
    const description = game.description
      ? game.description.replace(/<[^>]*>/g, '').slice(0, 200)
      : 'Городской автоквест на платформе ActQuest'

    const images = game.image ? [{ url: game.image, alt: title }] : []

    return {
      title,
      description,
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        title,
        description,
        ...(images.length > 0 && { images }),
      },
      twitter: {
        title,
        description,
        ...(images.length > 0 && { images: [game.image] }),
      },
    }
  } catch {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }
}

export default async function GameEntryPage({ params }) {
  const resolvedParams = await params
  const gameIdParam = resolvedParams?.id

  if (typeof gameIdParam !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameIdParam)
  if (!location) {
    notFound()
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent(`/game/${gameIdParam}`)}`,
    )
  }

  let payload
  try {
    const game = await fetchGame(location, gameIdParam)
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
        location,
        game: serializedGame,
        participantTeams: [],
        isParticipant: false,
        isGameStarted,
        isGameFinished,
        status,
        error: 'DB_CONNECTION_FAILED',
      }
    } else {
      const gamesTeams = await db
        .model('GamesTeams')
        .find({ gameId: gameIdParam })
        .lean()
      const teamIds = Array.isArray(gamesTeams)
        ? gamesTeams.map((gameTeam) => gameTeam?.teamId).filter(Boolean)
        : []

      let isParticipant = false
      let participantTeams = []
      const currentUserId =
        session?.user?._id === null || session?.user?._id === undefined
          ? null
          : String(session.user._id)

      if (teamIds.length > 0 && currentUserId) {
        const teamsUsers = await db
          .model('TeamsUsers')
          .find({ teamId: { $in: teamIds } })
          .lean()
        const memberships = teamsUsers.filter(
          (item) => String(item.userId || '') === currentUserId,
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

          const teams = await db
            .model('Teams')
            .find({ _id: { $in: membershipTeamIds } })
            .lean()
          participantTeams = teams
            .map((team) => {
              const id = String(team._id)
              const mappedTeam = gamesTeams.find(
                (gameTeam) => String(gameTeam.teamId) === id,
              )
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
        location,
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
      location,
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
