import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildTeamCaptainRepairReport from '@helpers/buildTeamCaptainRepairReport'
import buildTeamCaptainRepairWriteOperations from '@helpers/buildTeamCaptainRepairWriteOperations'

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

const normalizeTeamId = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''

const loadCaptainRepairReport = async ({ db, teamId, limit }) => {
  const TeamsUsersModel = db.model('TeamsUsers')
  const TeamsModel = db.model('Teams')
  const UsersModel = db.model('Users')

  const membershipFilter = teamId ? { teamId } : {}
  const memberships = await TeamsUsersModel.find(membershipFilter)
    .select({
      _id: 1,
      teamId: 1,
      userId: 1,
      userTelegramId: 1,
      role: 1,
      createdAt: 1,
    })
    .lean()

  const teamIds = Array.from(
    new Set(
      memberships
        .map((membership) =>
          membership?.teamId ? String(membership.teamId).trim() : '',
        )
        .filter(Boolean),
    ),
  )
  const teams = teamIds.length
    ? await TeamsModel.find({
        _id: { $in: teamIds },
        kind: { $ne: 'personal' },
      })
        .select({ _id: 1, name: 1, location: 1 })
        .lean()
    : []
  const regularTeamIds = new Set(teams.map((team) => String(team._id)))
  const regularMemberships = memberships.filter((membership) =>
    regularTeamIds.has(String(membership?.teamId || '')),
  )
  const regularUserIds = Array.from(
    new Set(
      regularMemberships
        .map((membership) =>
          membership?.userId ? String(membership.userId).trim() : '',
        )
        .filter(Boolean),
    ),
  )
  const users = regularUserIds.length
    ? await UsersModel.find({ _id: { $in: regularUserIds } })
        .select({ _id: 1, name: 1, username: 1 })
        .lean()
    : []

  return buildTeamCaptainRepairReport({
    teams,
    memberships: regularMemberships,
    users,
    limit,
  })
}

export async function GET(request) {
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

    const url = new URL(request.url)
    const limit = normalizeLimit(url.searchParams.get('limit'), 200, 1000)
    const teamId = normalizeTeamId(url.searchParams.get('teamId'))
    const report = await loadCaptainRepairReport({ db, teamId, limit })

    return NextResponse.json({ success: true, data: report }, { status: 200 })
  } catch (error) {
    console.error('Failed to audit team captains (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось проверить корректность капитанства в командах',
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

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const body = await request.json().catch(() => ({}))
    const teamId = normalizeTeamId(body?.teamId)
    const limit = normalizeLimit(body?.limit, 200, 1000)
    const apply = body?.apply === true
    const confirmApply = body?.confirmApply === true

    if (apply && !confirmApply) {
      return NextResponse.json(
        {
          success: false,
          error: 'Для применения исправления требуется confirmApply=true',
        },
        { status: 400 },
      )
    }

    const report = await loadCaptainRepairReport({ db, teamId, limit })

    if (!apply) {
      return NextResponse.json(
        {
          success: true,
          data: {
            mode: 'DRY-RUN',
            ...report,
          },
        },
        { status: 200 },
      )
    }

    const operations = buildTeamCaptainRepairWriteOperations({
      plans: report.plans,
      mongoose,
    })
    let membershipsUpdatedCount = 0

    if (operations.length > 0) {
      const writeResult = await db
        .model('TeamsUsers')
        .collection.bulkWrite(operations, { ordered: false })
      membershipsUpdatedCount = Number(writeResult.modifiedCount || 0)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          mode: 'APPLY',
          summary: {
            ...report.summary,
            membershipsUpdatedCount,
          },
          plans: report.plans,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to repair team captains (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось исправить капитанство в командах',
      },
      { status: 500 },
    )
  }
}
