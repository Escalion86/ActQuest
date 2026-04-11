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

const normalizeUser = (user) => ({
  id: String(user?._id || ''),
  name: typeof user?.name === 'string' ? user.name : '',
  username: typeof user?.username === 'string' ? user.username : '',
  telegramId: Number.isFinite(Number(user?.telegramId))
    ? Number(user.telegramId)
    : null,
  role: typeof user?.role === 'string' ? user.role : 'client',
  accountLocation:
    typeof user?.accountLocation === 'string'
      ? user.accountLocation
      : typeof user?.currentLocation === 'string'
        ? user.currentLocation
        : null,
  createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : null,
})

const buildMergePlan = ({ users, teamsUsersMemberships, games, keepUserId }) => {
  const keepUser = users[0]
  const keepTelegramId = Number.isFinite(Number(keepUser?.telegramId))
    ? Number(keepUser.telegramId)
    : null
  const removeUsers = users.slice(1)
  const removeUserIds = removeUsers.map((user) => String(user._id))

  const keepTeamIds = new Set(
    teamsUsersMemberships
      .filter((membership) => String(membership?.userId || '') === keepUserId)
      .map((membership) => String(membership?.teamId || ''))
      .filter(Boolean),
  )

  const teamMembershipActions = []
  let movedMembershipsCount = 0
  let removedDuplicateMembershipsCount = 0

  teamsUsersMemberships.forEach((membership) => {
    const membershipUserId = String(membership?.userId || '')
    if (!removeUserIds.includes(membershipUserId)) {
      return
    }

    const membershipId = membership?._id
    const teamId = String(membership?.teamId || '')
    if (!membershipId) return

    if (!teamId || keepTeamIds.has(teamId)) {
      teamMembershipActions.push({
        type: 'delete',
        membershipId: String(membershipId),
        teamId: teamId || null,
      })
      removedDuplicateMembershipsCount += 1
      return
    }

    keepTeamIds.add(teamId)
    teamMembershipActions.push({
      type: 'move',
      membershipId: String(membershipId),
      teamId,
      update: {
        userId: keepUserId,
        userTelegramId: keepTelegramId,
      },
    })
    movedMembershipsCount += 1
  })

  const gameActions = []
  let affectedGamesCount = 0
  let movedGameSnapshotMembershipsCount = 0
  let removedDuplicateGameSnapshotMembershipsCount = 0

  games.forEach((game) => {
    const rawMemberships = Array.isArray(game?.result?.teamsUsers)
      ? game.result.teamsUsers
      : []
    if (rawMemberships.length === 0) {
      return
    }

    const seenTeamIds = new Set()
    const nextMemberships = []
    let gameMovedCount = 0
    let gameRemovedCount = 0

    rawMemberships.forEach((membership) => {
      const membershipUserId = String(membership?.userId || '')
      const teamId = String(membership?.teamId || '')

      if (membershipUserId === keepUserId) {
        if (teamId && seenTeamIds.has(teamId)) {
          gameRemovedCount += 1
          return
        }
        if (teamId) seenTeamIds.add(teamId)
        nextMemberships.push(membership)
        return
      }

      if (removeUserIds.includes(membershipUserId)) {
        if (!teamId || seenTeamIds.has(teamId)) {
          gameRemovedCount += 1
          return
        }
        if (teamId) seenTeamIds.add(teamId)
        gameMovedCount += 1
        nextMemberships.push({
          ...membership,
          userId: keepUserId,
          userTelegramId: keepTelegramId,
        })
        return
      }

      nextMemberships.push(membership)
    })

    if (gameMovedCount === 0 && gameRemovedCount === 0) {
      return
    }

    movedGameSnapshotMembershipsCount += gameMovedCount
    removedDuplicateGameSnapshotMembershipsCount += gameRemovedCount
    affectedGamesCount += 1

    gameActions.push({
      gameId: String(game?._id || ''),
      gameName: typeof game?.name === 'string' ? game.name : '',
      movedMembershipsCount: gameMovedCount,
      removedDuplicateMembershipsCount: gameRemovedCount,
      nextTeamsUsers: nextMemberships,
    })
  })

  return {
    keepUser,
    removeUsers,
    removeUserIds,
    keepTelegramId,
    teamMembershipActions,
    movedMembershipsCount,
    removedDuplicateMembershipsCount,
    gameActions,
    affectedGamesCount,
    movedGameSnapshotMembershipsCount,
    removedDuplicateGameSnapshotMembershipsCount,
  }
}

export async function GET() {
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

    const duplicates = await db
      .model('Users')
      .aggregate([
        {
          $match: {
            phone: { $type: 'number', $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$phone',
            users: {
              $push: {
                _id: '$_id',
                name: '$name',
                username: '$username',
                telegramId: '$telegramId',
                role: '$role',
                accountLocation: '$accountLocation',
                currentLocation: '$currentLocation',
                createdAt: '$createdAt',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        {
          $sort: {
            count: -1,
            _id: 1,
          },
        },
      ])

    const normalizedGroups = duplicates.map((group) => {
      const users = Array.isArray(group?.users)
        ? group.users
            .slice()
            .sort((a, b) => {
              const firstTime = a?.createdAt
                ? new Date(a.createdAt).getTime()
                : 0
              const secondTime = b?.createdAt
                ? new Date(b.createdAt).getTime()
                : 0
              return secondTime - firstTime
            })
            .map(normalizeUser)
        : []

      return {
        phone: Number(group?._id),
        usersCount: Number(group?.count) || users.length,
        users,
      }
    })

    const usersCount = normalizedGroups.reduce(
      (acc, item) => acc + (Number(item?.usersCount) || 0),
      0,
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          duplicatePhonesCount: normalizedGroups.length,
          usersCount,
          groups: normalizedGroups,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load users with duplicate phones (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось загрузить пользователей с дублирующимися телефонами',
      },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const phone = Number(body?.phone)
  const dryRun = body?.dryRun !== false
  const confirmApply = body?.confirmApply === true

  if (!Number.isFinite(phone) || phone <= 0) {
    return NextResponse.json(
      { success: false, error: 'Некорректный номер телефона' },
      { status: 400 },
    )
  }
  if (!dryRun && !confirmApply) {
    return NextResponse.json(
      {
        success: false,
        error: 'Для применения изменений требуется confirmApply=true',
      },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Users = db.model('Users')
    const TeamsUsers = db.model('TeamsUsers')
    const Games = db.model('Games')

    const users = await Users.find({ phone })
      .select({
        _id: 1,
        phone: 1,
        telegramId: 1,
        name: 1,
        username: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1, _id: -1 })
      .lean()

    if (!Array.isArray(users) || users.length <= 1) {
      return NextResponse.json(
        {
          success: true,
          data: {
            merged: false,
            reason: 'nothing_to_merge',
            phone,
            usersCount: Array.isArray(users) ? users.length : 0,
          },
        },
        { status: 200 },
      )
    }

    const keepUser = users[0]
    const keepUserId = String(keepUser._id)
    const removeUsers = users.slice(1)
    const removeUserIds = removeUsers.map((user) => String(user._id))

    const memberships = await TeamsUsers.find({
      userId: { $in: [keepUserId, ...removeUserIds] },
    })
      .select({ _id: 1, teamId: 1, userId: 1 })
      .lean()

    const games = await Games.find({
      'result.teamsUsers.userId': { $in: [keepUserId, ...removeUserIds] },
    })
      .select({ _id: 1, name: 1, 'result.teamsUsers': 1 })
      .lean()

    const mergePlan = buildMergePlan({
      users,
      teamsUsersMemberships: memberships,
      games,
      keepUserId,
    })

    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          data: {
            preview: true,
            phone,
            keepUser: normalizeUser(mergePlan.keepUser),
            removeUsers: mergePlan.removeUsers.map(normalizeUser),
            usersToDeleteCount: mergePlan.removeUsers.length,
            teamsUsers: {
              movedMembershipsCount: mergePlan.movedMembershipsCount,
              removedDuplicateMembershipsCount:
                mergePlan.removedDuplicateMembershipsCount,
            },
            gamesResultSnapshots: {
              affectedGamesCount: mergePlan.affectedGamesCount,
              movedMembershipsCount:
                mergePlan.movedGameSnapshotMembershipsCount,
              removedDuplicateMembershipsCount:
                mergePlan.removedDuplicateGameSnapshotMembershipsCount,
              games: mergePlan.gameActions.map((gameAction) => ({
                gameId: gameAction.gameId,
                gameName: gameAction.gameName,
                movedMembershipsCount: gameAction.movedMembershipsCount,
                removedDuplicateMembershipsCount:
                  gameAction.removedDuplicateMembershipsCount,
              })),
            },
          },
        },
        { status: 200 },
      )
    }

    const bulkOps = mergePlan.teamMembershipActions.map((action) => {
      if (action.type === 'delete') {
        return {
          deleteOne: {
            filter: { _id: action.membershipId },
          },
        }
      }

      return {
        updateOne: {
          filter: { _id: action.membershipId },
          update: {
            $set: action.update,
          },
        },
      }
    })

    if (bulkOps.length > 0) {
      await TeamsUsers.bulkWrite(bulkOps, { ordered: false })
    }

    for (const gameAction of mergePlan.gameActions) {
      await Games.updateOne(
        { _id: gameAction.gameId },
        {
          $set: {
            'result.teamsUsers': gameAction.nextTeamsUsers,
          },
        },
      )
    }

    const deleteUsersResult = await Users.deleteMany({
      _id: { $in: mergePlan.removeUserIds },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          merged: true,
          phone,
          keepUser: normalizeUser(mergePlan.keepUser),
          deletedUsersCount: Number(deleteUsersResult?.deletedCount) || 0,
          movedMembershipsCount: mergePlan.movedMembershipsCount,
          removedDuplicateMembershipsCount:
            mergePlan.removedDuplicateMembershipsCount,
          updatedGamesCount: mergePlan.affectedGamesCount,
          movedGameSnapshotMembershipsCount:
            mergePlan.movedGameSnapshotMembershipsCount,
          removedDuplicateGameSnapshotMembershipsCount:
            mergePlan.removedDuplicateGameSnapshotMembershipsCount,
          removedUserIds: mergePlan.removeUserIds,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to merge duplicate phone users (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось объединить пользователей с одинаковым телефоном',
      },
      { status: 500 },
    )
  }
}
