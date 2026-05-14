import getSecondsBetween from '@helpers/getSecondsBetween'
import { toStringId } from '@helpers/idAndDate'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }
  return ''
}

const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const canBypassAgentAssignment = (role) =>
  ['admin', 'dev', 'moder'].includes(normalizeRole(role))

export const resolveGameAgents = (game) =>
  (Array.isArray(game?.agents) ? game.agents : [])
    .map((agent) => ({
      userId: normalizeStringId(agent?.userId ?? agent?.id ?? agent),
      active: agent?.active !== false,
    }))
    .filter((agent) => agent.userId && agent.active)

export const getTaskAgentIds = (task) =>
  (Array.isArray(task?.agentUserIds) ? task.agentUserIds : [])
    .map(normalizeStringId)
    .filter(Boolean)

export const getStoryNodeAgentIds = (node) =>
  (Array.isArray(node?.agentUserIds) ? node.agentUserIds : [])
    .map(normalizeStringId)
    .filter(Boolean)

const isStoryGame = (game) =>
  game?.type === 'story' || (Array.isArray(game?.storyNodes) && game.storyNodes.length > 0)

const getAssignedTaskIndexes = ({ game, userId, role }) => {
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const shouldBypass = canBypassAgentAssignment(role)
  const normalizedUserId = normalizeStringId(userId)

  return tasks
    .map((task, index) => {
      const agentIds = getTaskAgentIds(task)
      if (agentIds.length === 0) return null
      if (!shouldBypass && !agentIds.includes(normalizedUserId)) return null
      return index
    })
    .filter((index) => Number.isInteger(index))
}

const getAssignedStoryNodes = ({ game, userId, role }) => {
  const nodes = Array.isArray(game?.storyNodes) ? game.storyNodes : []
  const shouldBypass = canBypassAgentAssignment(role)
  const normalizedUserId = normalizeStringId(userId)

  return nodes
    .map((node) => {
      const agentIds = getStoryNodeAgentIds(node)
      if (agentIds.length === 0) return null
      if (!shouldBypass && !agentIds.includes(normalizedUserId)) return null
      return {
        nodeId: normalizeStringId(node?.id),
        title: node?.title || '',
      }
    })
    .filter((node) => node?.nodeId)
}

const ensureArray = (value) => (Array.isArray(value) ? value : [])

export const hasTeamPassedTask = (gameTeam, taskIndex, tasksCount) => {
  const activeNum = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const endTime = ensureArray(gameTeam?.endTime)

  if (tasksCount > 0 && activeNum >= tasksCount) {
    return true
  }

  return activeNum > taskIndex || Boolean(endTime[taskIndex])
}

const resolveTeamStoryAgentStatus = ({ gameTeam, assignedStoryNodes }) => {
  const progress = gameTeam?.storyProgress || {}
  const unlockedNodeIds = new Set(ensureArray(progress?.unlockedNodeIds).map(normalizeStringId))
  const completedNodeIds = new Set(
    ensureArray(progress?.completedNodeIds).map(normalizeStringId),
  )
  const isFinished = ['completed', 'failed'].includes(progress?.status)

  const activeNode = assignedStoryNodes.find(
    (node) => unlockedNodeIds.has(node.nodeId) && !completedNodeIds.has(node.nodeId),
  )
  if (activeNode) {
    return {
      status: 'active',
      storyNodeId: activeNode.nodeId,
      currentTaskSeconds: progress?.startedAt
        ? getSecondsBetween(progress.startedAt, new Date())
        : 0,
    }
  }

  const waitingNode = assignedStoryNodes.find(
    (node) => !completedNodeIds.has(node.nodeId),
  )

  if (!waitingNode) {
    return {
      status: 'passed',
      storyNodeId: assignedStoryNodes[assignedStoryNodes.length - 1]?.nodeId || null,
      currentTaskSeconds: 0,
    }
  }

  if (isFinished) {
    return {
      status: 'finished',
      storyNodeId: waitingNode.nodeId,
      currentTaskSeconds: 0,
    }
  }

  return {
    status: 'waiting',
    storyNodeId: waitingNode.nodeId,
    currentTaskSeconds: progress?.startedAt
      ? getSecondsBetween(progress.startedAt, new Date())
      : 0,
  }
}

const resolveTeamAgentStatus = ({ gameTeam, assignedTaskIndexes, tasksCount }) => {
  const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const startTime = ensureArray(gameTeam?.startTime)
  const endTime = ensureArray(gameTeam?.endTime)
  const now = new Date()
  const isFinished = tasksCount > 0 && activeTaskIndex >= tasksCount

  const activeAssignedTaskIndex = assignedTaskIndexes.find(
    (taskIndex) =>
      activeTaskIndex === taskIndex &&
      Boolean(startTime[taskIndex]) &&
      !Boolean(endTime[taskIndex]),
  )
  if (Number.isInteger(activeAssignedTaskIndex)) {
    return {
      status: 'active',
      taskIndex: activeAssignedTaskIndex,
      currentTaskSeconds: getSecondsBetween(
        startTime[activeAssignedTaskIndex],
        now,
      ),
    }
  }

  const approachingTaskIndex = assignedTaskIndexes.find(
    (taskIndex) =>
      activeTaskIndex + 1 === taskIndex &&
      Boolean(startTime[activeTaskIndex]) &&
      !isFinished,
  )
  if (Number.isInteger(approachingTaskIndex)) {
    return {
      status: 'approaching',
      taskIndex: approachingTaskIndex,
      currentTaskSeconds: startTime[activeTaskIndex]
        ? getSecondsBetween(startTime[activeTaskIndex], now)
        : 0,
    }
  }

  const hasUnpassedAssignedTask = assignedTaskIndexes.some(
    (taskIndex) => !hasTeamPassedTask(gameTeam, taskIndex, tasksCount),
  )

  if (!hasUnpassedAssignedTask || isFinished) {
    return {
      status: isFinished ? 'finished' : 'passed',
      taskIndex: assignedTaskIndexes[assignedTaskIndexes.length - 1] ?? null,
      currentTaskSeconds: 0,
    }
  }

  return {
    status: 'waiting',
    taskIndex: assignedTaskIndexes.find(
      (taskIndex) => !hasTeamPassedTask(gameTeam, taskIndex, tasksCount),
    ) ?? null,
    currentTaskSeconds: startTime[activeTaskIndex]
      ? getSecondsBetween(startTime[activeTaskIndex], now)
      : 0,
  }
}

export const buildAgentGameStatus = async ({ db, gameId, userId, role }) => {
  const normalizedGameId = normalizeStringId(gameId)
  const normalizedUserId = normalizeStringId(userId)
  if (!db || !normalizedGameId || !normalizedUserId) {
    return { success: false, statusCode: 400, error: 'INVALID_PARAMS' }
  }

  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const Teams = db.model('Teams')

  const game = await Games.findById(normalizedGameId)
    .select({
      _id: 1,
      name: 1,
      status: 1,
      location: 1,
      tasks: 1,
      type: 1,
      storyNodes: 1,
      agents: 1,
      agentNotifications: 1,
    })
    .lean()

  if (!game?._id) {
    return { success: false, statusCode: 404, error: 'GAME_NOT_FOUND' }
  }

  const gameAgents = resolveGameAgents(game)
  const canBypass = canBypassAgentAssignment(role)
  const isAssignedAgent = gameAgents.some(
    (agent) => agent.userId === normalizedUserId,
  )
  if (!canBypass && !isAssignedAgent) {
    return { success: false, statusCode: 403, error: 'ACCESS_DENIED' }
  }

  const storyGame = isStoryGame(game)
  const tasks = Array.isArray(game.tasks) ? game.tasks : []
  const storyNodes = Array.isArray(game.storyNodes) ? game.storyNodes : []
  const assignedTaskIndexes = getAssignedTaskIndexes({
    game,
    userId: normalizedUserId,
    role,
  })
  const assignedStoryNodes = getAssignedStoryNodes({
    game,
    userId: normalizedUserId,
    role,
  })
  const storyNodesById = new Map(storyNodes.map((node) => [normalizeStringId(node?.id), node]))

  const gameTeams = await GamesTeams.find({ gameId: normalizedGameId }).lean()
  const teamIds = Array.from(
    new Set(gameTeams.map((entry) => toStringId(entry?.teamId)).filter(Boolean)),
  )
  const teams = teamIds.length
    ? await Teams.find({ _id: { $in: teamIds } })
        .select({ _id: 1, name: 1 })
        .lean()
    : []
  const teamsById = new Map(teams.map((team) => [toStringId(team?._id), team]))

  const teamStatuses = gameTeams.map((gameTeam) => {
    const teamId = toStringId(gameTeam?.teamId)
    const status = storyGame
      ? resolveTeamStoryAgentStatus({ gameTeam, assignedStoryNodes })
      : resolveTeamAgentStatus({
          gameTeam,
          assignedTaskIndexes,
          tasksCount: tasks.length,
        })
    const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
      ? gameTeam.activeNum
      : Number(gameTeam?.activeNum) || 0
    const currentStoryNodeIds = ensureArray(
      gameTeam?.storyProgress?.unlockedNodeIds,
    ).filter(
      (nodeId) =>
        !ensureArray(gameTeam?.storyProgress?.completedNodeIds).includes(nodeId),
    )
    const currentStoryNode = storyNodesById.get(normalizeStringId(currentStoryNodeIds[0]))
    const agentStoryNode = storyNodesById.get(normalizeStringId(status.storyNodeId))

    return {
      gameTeamId: toStringId(gameTeam?._id),
      teamId,
      teamName: teamsById.get(teamId)?.name || 'Без названия',
      activeTaskIndex,
      currentStoryNodeId: currentStoryNodeIds[0] || null,
      currentTaskTitle:
        storyGame && currentStoryNode
          ? currentStoryNode.title || ''
          : activeTaskIndex >= 0 && activeTaskIndex < tasks.length
          ? tasks[activeTaskIndex]?.title || ''
          : '',
      agentTaskIndex: status.taskIndex,
      agentStoryNodeId: status.storyNodeId || null,
      agentTaskTitle:
        storyGame && agentStoryNode
          ? agentStoryNode.title || ''
          : Number.isInteger(status.taskIndex) && tasks[status.taskIndex]
          ? tasks[status.taskIndex]?.title || ''
          : '',
      status: status.status,
      currentTaskSeconds: status.currentTaskSeconds,
    }
  })

  const statusOrder = {
    active: 0,
    approaching: 1,
    waiting: 2,
    passed: 3,
    finished: 4,
  }
  teamStatuses.sort((left, right) => {
    const leftOrder = statusOrder[left.status] ?? 99
    const rightOrder = statusOrder[right.status] ?? 99
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return (left.teamName || '').localeCompare(right.teamName || '', 'ru')
  })

  const remainingTeamsCount = teamStatuses.filter(
    (team) => team.status !== 'passed' && team.status !== 'finished',
  ).length

  return {
    success: true,
    data: {
      gameId: toStringId(game._id),
      gameName: game.name || '',
      location: game.location || '',
      status: game.status || 'active',
      type: storyGame ? 'story' : game.type || '',
      assignedTasks: storyGame
        ? assignedStoryNodes.map((node) => ({
            storyNodeId: node.nodeId,
            title: node.title || '',
          }))
        : assignedTaskIndexes.map((taskIndex) => ({
            taskIndex,
            title: tasks[taskIndex]?.title || '',
          })),
      remainingTeamsCount,
      teams: teamStatuses,
      serverTime: new Date().toISOString(),
    },
  }
}
