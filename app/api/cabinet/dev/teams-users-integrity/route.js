import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const normalizeLimit = (value, fallback = 200, max = 1000) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }

  return Math.min(Math.trunc(numeric), max)
}

const toIsoStringOrNull = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const url = new URL(req.url)
    const limit = normalizeLimit(url.searchParams.get('limit'), 200, 1000)

    const teamsUsersModel = db.model('TeamsUsers')
    const usersModel = db.model('Users')
    const teamsModel = db.model('Teams')

    const usersCollectionName = usersModel.collection?.name || 'users'
    const teamsCollectionName = teamsModel.collection?.name || 'teams'

    const totalMembershipsCount = await teamsUsersModel.countDocuments({})

    const baseLookupStages = [
      {
        $lookup: {
          from: usersCollectionName,
          let: { membershipUserId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$membershipUserId'],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                username: 1,
                telegramId: 1,
              },
            },
          ],
          as: 'matchedUsers',
        },
      },
      {
        $lookup: {
          from: teamsCollectionName,
          let: { membershipTeamId: '$teamId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$membershipTeamId'],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                location: 1,
              },
            },
          ],
          as: 'matchedTeams',
        },
      },
      {
        $addFields: {
          missingUser: {
            $eq: [{ $size: '$matchedUsers' }, 0],
          },
          missingTeam: {
            $eq: [{ $size: '$matchedTeams' }, 0],
          },
        },
      },
      {
        $match: {
          $or: [{ missingUser: true }, { missingTeam: true }],
        },
      },
    ]

    const [stats] = await teamsUsersModel.aggregate([
      ...baseLookupStages,
      {
        $group: {
          _id: null,
          brokenMembershipsCount: { $sum: 1 },
          missingUserCount: {
            $sum: {
              $cond: ['$missingUser', 1, 0],
            },
          },
          missingTeamCount: {
            $sum: {
              $cond: ['$missingTeam', 1, 0],
            },
          },
          missingBothCount: {
            $sum: {
              $cond: [{ $and: ['$missingUser', '$missingTeam'] }, 1, 0],
            },
          },
        },
      },
    ])

    const brokenMembershipsRaw = await teamsUsersModel.aggregate([
      ...baseLookupStages,
      {
        $sort: {
          createdAt: -1,
          _id: 1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          teamId: 1,
          userId: 1,
          userTelegramId: 1,
          role: 1,
          createdAt: 1,
          updatedAt: 1,
          missingUser: 1,
          missingTeam: 1,
          user: {
            $arrayElemAt: ['$matchedUsers', 0],
          },
          team: {
            $arrayElemAt: ['$matchedTeams', 0],
          },
        },
      },
    ])

    const brokenMemberships = brokenMembershipsRaw.map((item) => {
      const issueCodes = []
      if (item?.missingUser) {
        issueCodes.push('missing_user')
      }
      if (item?.missingTeam) {
        issueCodes.push('missing_team')
      }

      return {
        id: item?._id ? String(item._id) : '',
        userId:
          typeof item?.userId === 'string' && item.userId.trim().length > 0
            ? item.userId
            : null,
        teamId:
          typeof item?.teamId === 'string' && item.teamId.trim().length > 0
            ? item.teamId
            : null,
        userTelegramId: Number.isFinite(Number(item?.userTelegramId))
          ? Number(item.userTelegramId)
          : null,
        role: typeof item?.role === 'string' ? item.role : 'participant',
        missingUser: Boolean(item?.missingUser),
        missingTeam: Boolean(item?.missingTeam),
        issueCodes,
        user:
          item?.user && item.user._id
            ? {
                id: String(item.user._id),
                name: typeof item.user?.name === 'string' ? item.user.name : '',
                username:
                  typeof item.user?.username === 'string'
                    ? item.user.username
                    : '',
                telegramId: Number.isFinite(Number(item.user?.telegramId))
                  ? Number(item.user.telegramId)
                  : null,
              }
            : null,
        team:
          item?.team && item.team._id
            ? {
                id: String(item.team._id),
                name: typeof item.team?.name === 'string' ? item.team.name : '',
                location:
                  typeof item.team?.location === 'string'
                    ? item.team.location
                    : null,
              }
            : null,
        createdAt: toIsoStringOrNull(item?.createdAt),
        updatedAt: toIsoStringOrNull(item?.updatedAt),
      }
    })

    const brokenMembershipsCount = Number(stats?.brokenMembershipsCount) || 0
    const missingUserCount = Number(stats?.missingUserCount) || 0
    const missingTeamCount = Number(stats?.missingTeamCount) || 0
    const missingBothCount = Number(stats?.missingBothCount) || 0

    return NextResponse.json(
      {
        success: true,
        data: {
          totalMembershipsCount,
          brokenMembershipsCount,
          missingUserCount,
          missingTeamCount,
          missingBothCount,
          limitApplied: limit,
          brokenMembershipsReturned: brokenMemberships.length,
          truncated:
            brokenMembershipsCount > 0 &&
            brokenMemberships.length < brokenMembershipsCount,
          brokenMemberships,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to check teams users integrity (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось проверить целостность связей участников команд',
      },
      { status: 500 },
    )
  }
}
