import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import withGameTeamsLocked from '@server/withGameTeamsLocked'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'
import { toStringId } from '@helpers/idAndDate'
import {
  buildBalancedTaskSequences,
  getLockedTaskSequencePrefix,
  isValidTaskSequence,
  isManualTaskSequence,
  normalizeStoredTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

const normalizeStringId = (value) => (toStringId(value) || '').trim()

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const findGameByAnyId = async (GamesModel, rawGameId) => {
  const gameId = normalizeStringId(rawGameId)
  if (!gameId) return null

  if (isObjectIdLike(gameId)) {
    const game = await GamesModel.findById(gameId)
      .select({
        _id: 1,
        id: 1,
        location: 1,
        moderators: 1,
        tasks: 1,
        taskDistributionMode: 1,
        taskDistributionTemplate: 1,
      })
      .lean()
    if (game?._id) return game
  }

  return GamesModel.findOne({ id: gameId })
    .select({
      _id: 1,
      id: 1,
      location: 1,
      moderators: 1,
      tasks: 1,
      taskDistributionMode: 1,
      taskDistributionTemplate: 1,
    })
    .lean()
}

const buildValidationError = (prefix, validation) => {
  const message = Array.isArray(validation?.messages)
    ? validation.messages.filter(Boolean).join('; ')
    : ''
  return message ? `${prefix}: ${message}` : prefix
}

const resolveTemplateForTeam = ({ gameTemplate, gameTeam, tasksCount }) => {
  const teamTemplate = normalizeStoredTaskDistributionTemplate(
    gameTeam?.taskDistributionTemplate,
    tasksCount,
  )

  if (teamTemplate.length > 0) {
    return {
      template: teamTemplate,
      source: 'team_template',
    }
  }

  return {
    template: gameTemplate,
    source: 'game_template',
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const payload = await request.json().catch(() => ({}))
  const gameId = normalizeStringId(payload?.gameId)
  const teamId = normalizeStringId(payload?.teamId)

  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  const userRole =
    typeof session.user.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''
  const currentUserId = normalizeStringId(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')

    const game = await findGameByAnyId(GamesModel, gameId)
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!canAccessGameAsModerator({ userRole, currentUserId, game })) {
      return NextResponse.json(
        { success: false, error: 'Нет доступа к этой игре' },
        { status: 403 },
      )
    }

    return await withGameTeamsLocked({ db, gameId: game._id }, async ({ game, teams, teamModel, assertHeld }) => {
      if (!canAccessGameAsModerator({ userRole, currentUserId, game })) {
        return NextResponse.json({ success: false, error: 'Нет доступа к этой игре' }, { status: 403 })
      }
      if (['finished', 'closed'].includes(game.status)) {
        return NextResponse.json({ success: false, error: 'Нельзя менять маршрут завершённой игры' }, { status: 409 })
      }
      if (game.taskDistributionMode !== 'random') {
        return NextResponse.json(
          {
            success: false,
            error: 'Распределение доступно только для режима «Случайное»',
          },
          { status: 400 },
        )
      }

      const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
      const gameTemplate = normalizeStoredTaskDistributionTemplate(
        game.taskDistributionTemplate,
        tasksCount,
      )
      const gameTemplateValidation = validateTaskDistributionTemplate(
        gameTemplate,
        tasksCount,
      )

      if (!gameTemplateValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: buildValidationError(
              'Общий шаблон распределения некорректен',
              gameTemplateValidation,
            ),
          },
          { status: 400 },
        )
      }

      const normalizedGameId = normalizeStringId(game._id)
      const gameTeams = teams.filter((team) => !teamId ||
        normalizeStringId(team._id) === teamId || normalizeStringId(team.teamId) === teamId)

      if (teamId && gameTeams.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Команда не найдена в этой игре' },
          { status: 404 },
        )
      }

      const generatedAt = new Date()
      const requests = []

      for (const gameTeam of gameTeams) {
        if (isManualTaskSequence(gameTeam)) continue
        const { template, source } = resolveTemplateForTeam({
          gameTemplate,
          gameTeam,
          tasksCount,
        })
        const validation = validateTaskDistributionTemplate(template, tasksCount)

        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              error: buildValidationError(
                `Индивидуальный шаблон команды ${normalizeStringId(gameTeam?.teamId) || normalizeStringId(gameTeam?._id)} некорректен`,
                validation,
              ),
            },
            { status: 400 },
          )
        }

        requests.push({ gameTeam, template, source, lockedPrefix: getLockedTaskSequencePrefix(gameTeam) })
      }

      const selectedIds = new Set(gameTeams.map(team => String(team._id)))
      const sequences = buildBalancedTaskSequences(requests, teams
        .filter(team => !selectedIds.has(String(team._id)) && !isManualTaskSequence(team) && isValidTaskSequence(team.taskSequence, tasksCount))
        .map(team => ({ taskSequence: team.taskSequence, template: resolveTemplateForTeam({ gameTemplate, gameTeam: team, tasksCount }).template })))
      const updates = []
      for (const [index, { gameTeam, source }] of requests.entries()) {
        const taskSequence = sequences[index]

        if (!isValidTaskSequence(taskSequence, tasksCount)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Не удалось собрать корректную последовательность заданий',
            },
            { status: 400 },
          )
        }

        updates.push({
          id: gameTeam._id,
          gameTeamId: normalizeStringId(gameTeam._id),
          teamId: normalizeStringId(gameTeam.teamId),
          taskSequence,
          taskSequenceSource: source,
        })
      }

      await assertHeld()
      for (const item of updates) {
        const updatedTeam = await teamModel(item.id).findByIdAndUpdate(item.id, {
          $set: {
            taskSequence: item.taskSequence,
            taskSequenceSource: item.taskSequenceSource,
            taskSequenceGeneratedAt: generatedAt,
          },
        })
        // Молчаливая неудача записи выдала бы успех без изменённого маршрута.
        if (!updatedTeam) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Не удалось сохранить распределение заданий. Обновите список команд и повторите.',
            },
            { status: 500 },
          )
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          gameId: normalizedGameId,
          teamsUpdated: updates.length,
          teams: updates.map((item) => ({
            gameTeamId: item.gameTeamId,
            teamId: item.teamId,
            taskSequence: item.taskSequence,
            taskSequenceSource: item.taskSequenceSource,
            taskSequenceGeneratedAt: generatedAt.toISOString(),
          })),
        },
      })
    })
  } catch (error) {
    console.error('Failed to distribute game tasks', { error, gameId, teamId })
    return NextResponse.json(
      { success: false, error: error.statusCode === 409 ? error.message : 'Не удалось распределить задания' },
      { status: error.statusCode || 500 },
    )
  }
}
