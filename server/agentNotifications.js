import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import {
  getStoryNodeAgentIds,
  getTaskAgentIds,
  hasTeamPassedTask,
  resolveGameAgents,
} from '@server/agentGameStatus'
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

const ensureArray = (value) => (Array.isArray(value) ? value : [])

const buildEventKey = ({
  gameId,
  gameTeamId,
  agentUserId,
  taskIndex,
  storyNodeId,
  eventType,
}) =>
  [
    'agent',
    normalizeStringId(gameId),
    normalizeStringId(gameTeamId) || 'all-teams',
    normalizeStringId(agentUserId),
    Number.isInteger(taskIndex)
      ? `task-${taskIndex}`
      : normalizeStringId(storyNodeId)
        ? `story-${normalizeStringId(storyNodeId)}`
        : 'no-task',
    eventType,
  ].join(':')

const getAgentNotificationSettings = (game) => ({
  onPreviousTask: game?.agentNotifications?.onPreviousTask !== false,
  onCurrentTask: game?.agentNotifications?.onCurrentTask !== false,
  onTaskCompleted: game?.agentNotifications?.onTaskCompleted === true,
  onAllTeamsPassed: game?.agentNotifications?.onAllTeamsPassed !== false,
})

const resolveTaskEventsForTeam = ({ game, gameTeam }) => {
  const settings = getAgentNotificationSettings(game)
  const tasks = ensureArray(game?.tasks)
  const tasksCount = tasks.length
  const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const startTime = ensureArray(gameTeam?.startTime)
  const endTime = ensureArray(gameTeam?.endTime)
  const events = []

  tasks.forEach((task, taskIndex) => {
    const agentUserIds = getTaskAgentIds(task)
    if (agentUserIds.length === 0) return

    if (
      settings.onPreviousTask &&
      activeTaskIndex + 1 === taskIndex &&
      Boolean(startTime[activeTaskIndex])
    ) {
      events.push({ eventType: 'previous_task', taskIndex, agentUserIds })
    }

    if (
      settings.onCurrentTask &&
      activeTaskIndex === taskIndex &&
      Boolean(startTime[taskIndex]) &&
      !Boolean(endTime[taskIndex])
    ) {
      events.push({ eventType: 'current_task', taskIndex, agentUserIds })
    }

    if (
      settings.onTaskCompleted &&
      hasTeamPassedTask(gameTeam, taskIndex, tasksCount)
    ) {
      events.push({ eventType: 'task_completed', taskIndex, agentUserIds })
    }
  })

  return events
}

const hasStoryTeamPassedNode = (gameTeam, storyNodeId) =>
  ensureArray(gameTeam?.storyProgress?.completedNodeIds)
    .map(normalizeStringId)
    .includes(normalizeStringId(storyNodeId))

const resolveStoryNodeEventsForTeam = ({ game, gameTeam }) => {
  const settings = getAgentNotificationSettings(game)
  const nodes = ensureArray(game?.storyNodes)
  const unlockedNodeIds = new Set(
    ensureArray(gameTeam?.storyProgress?.unlockedNodeIds).map(normalizeStringId),
  )
  const completedNodeIds = new Set(
    ensureArray(gameTeam?.storyProgress?.completedNodeIds).map(normalizeStringId),
  )
  const events = []

  nodes.forEach((node) => {
    const storyNodeId = normalizeStringId(node?.id)
    const agentUserIds = getStoryNodeAgentIds(node)
    if (!storyNodeId || agentUserIds.length === 0) return

    if (
      settings.onCurrentTask &&
      unlockedNodeIds.has(storyNodeId) &&
      !completedNodeIds.has(storyNodeId)
    ) {
      events.push({ eventType: 'current_task', storyNodeId, agentUserIds })
    }

    if (settings.onTaskCompleted && completedNodeIds.has(storyNodeId)) {
      events.push({ eventType: 'task_completed', storyNodeId, agentUserIds })
    }
  })

  return events
}

const isStoryGame = (game) =>
  game?.type === 'story' || (Array.isArray(game?.storyNodes) && game.storyNodes.length > 0)

const buildNotificationText = ({ eventType, game, team, task, storyNode }) => {
  const teamName = team?.name || 'Команда'
  const taskTitle = task?.title || storyNode?.title || 'задание'
  const subject = storyNode ? 'локацию' : 'задание'

  if (eventType === 'previous_task') {
    return `Команда «${teamName}» на предыдущем задании и скоро прибудет к вам: «${taskTitle}».`
  }
  if (eventType === 'current_task') {
    return `Команда «${teamName}» начала вашу ${subject}: «${taskTitle}».`
  }
  if (eventType === 'task_completed') {
    return `Команда «${teamName}» прошла вашу ${subject}: «${taskTitle}».`
  }
  return `Все команды прошли вашу ${subject} в игре «${game?.name || 'Игра'}»: «${taskTitle}».`
}

const sendAgentEvent = async ({
  db,
  game,
  team,
  gameTeam,
  agentUserId,
  taskIndex,
  storyNodeId,
  eventType,
}) => {
  const gameId = toStringId(game?._id) || normalizeStringId(game?.id)
  const gameTeamId = toStringId(gameTeam?._id)
  const teamId = normalizeStringId(team?._id ?? team?.id ?? gameTeam?.teamId)
  const normalizedAgentUserId = normalizeStringId(agentUserId)
  if (!gameId || !normalizedAgentUserId) return null

  const eventKey = buildEventKey({
    gameId,
    gameTeamId: eventType === 'all_teams_passed' ? '' : gameTeamId,
    agentUserId: normalizedAgentUserId,
    taskIndex,
    storyNodeId,
    eventType,
  })

  const Log = db.model('AgentNotificationsLog')
  const existing = await Log.findOne({ eventKey }).select({ _id: 1 }).lean()
  if (existing?._id) return null

  try {
    await Log.create({
      eventKey,
      gameId,
      gameTeamId: eventType === 'all_teams_passed' ? null : gameTeamId,
      teamId: eventType === 'all_teams_passed' ? null : teamId,
      agentUserId: normalizedAgentUserId,
      taskIndex,
      storyNodeId: normalizeStringId(storyNodeId) || null,
      eventType,
    })
  } catch (error) {
    if (error?.code === 11000) return null
    throw error
  }

  const Users = db.model('Users')
  const agentUser = await Users.findById(normalizedAgentUserId)
    .select({ _id: 1, pushSubscriptions: 1 })
    .lean()
  if (!agentUser?._id) return null

  const task = ensureArray(game?.tasks)[taskIndex] || null
  const storyNode =
    normalizeStringId(storyNodeId) && Array.isArray(game?.storyNodes)
      ? game.storyNodes.find(
          (node) => normalizeStringId(node?.id) === normalizeStringId(storyNodeId),
        )
      : null
  const body = buildNotificationText({ eventType, game, team, task, storyNode })
  return broadcastNotificationToUsers({
    db,
    users: [agentUser],
    notification: {
      title: 'ActQuest: агентское задание',
      body,
      location: game?.location || 'global',
      tag: eventKey,
      url: `/cabinet/agent/game-control?gameId=${encodeURIComponent(gameId)}`,
      data: {
        type: 'agent_task',
        gameId,
        taskIndex,
        storyNodeId: normalizeStringId(storyNodeId) || null,
        eventType,
        teamId,
      },
    },
  })
}

const notifyAllTeamsPassedEvents = async ({ db, game }) => {
  const settings = getAgentNotificationSettings(game)
  if (!settings.onAllTeamsPassed) return

  const tasks = ensureArray(game?.tasks)
  const storyNodes = ensureArray(game?.storyNodes)
  const gameId = toStringId(game?._id) || normalizeStringId(game?.id)
  if (!gameId || (tasks.length === 0 && storyNodes.length === 0)) return

  const GamesTeams = db.model('GamesTeams')
  const gameTeams = await GamesTeams.find({ gameId }).lean()
  if (gameTeams.length === 0) return

  const activeAgentIds = new Set(resolveGameAgents(game).map((agent) => agent.userId))
  if (isStoryGame(game)) {
    await Promise.all(
      storyNodes.map(async (node) => {
        const storyNodeId = normalizeStringId(node?.id)
        const agentUserIds = getStoryNodeAgentIds(node).filter((agentId) =>
          activeAgentIds.has(agentId),
        )
        if (!storyNodeId || agentUserIds.length === 0) return

        const allPassed = gameTeams.every((gameTeam) =>
          hasStoryTeamPassedNode(gameTeam, storyNodeId),
        )
        if (!allPassed) return

        await Promise.all(
          agentUserIds.map((agentUserId) =>
            sendAgentEvent({
              db,
              game,
              team: null,
              gameTeam: null,
              agentUserId,
              storyNodeId,
              eventType: 'all_teams_passed',
            }),
          ),
        )
      }),
    )
    return
  }

  await Promise.all(
    tasks.map(async (task, taskIndex) => {
      const agentUserIds = getTaskAgentIds(task).filter((agentId) =>
        activeAgentIds.has(agentId),
      )
      if (agentUserIds.length === 0) return

      const allPassed = gameTeams.every((gameTeam) =>
        hasTeamPassedTask(gameTeam, taskIndex, tasks.length),
      )
      if (!allPassed) return

      await Promise.all(
        agentUserIds.map((agentUserId) =>
          sendAgentEvent({
            db,
            game,
            team: null,
            gameTeam: null,
            agentUserId,
            taskIndex,
            eventType: 'all_teams_passed',
          }),
        ),
      )
    }),
  )
}

export const notifyAgentsForGameTeamProgress = async ({
  db,
  game,
  gameTeam,
  team,
}) => {
  if (!db || !game || !gameTeam) return

  try {
    const activeGameAgents = resolveGameAgents(game)
    if (activeGameAgents.length === 0) return
    const activeAgentIds = new Set(activeGameAgents.map((agent) => agent.userId))

    const events = isStoryGame(game)
      ? resolveStoryNodeEventsForTeam({ game, gameTeam })
      : resolveTaskEventsForTeam({ game, gameTeam })
    await Promise.all(
      events.flatMap((event) =>
        event.agentUserIds
          .filter((agentUserId) => activeAgentIds.has(agentUserId))
          .map((agentUserId) =>
            sendAgentEvent({
              db,
              game,
              team,
              gameTeam,
              agentUserId,
              taskIndex: event.taskIndex,
              storyNodeId: event.storyNodeId,
              eventType: event.eventType,
            }),
          ),
      ),
    )

    await notifyAllTeamsPassedEvents({ db, game })
  } catch (error) {
    console.error('Failed to notify game agents', {
      error,
      gameId: toStringId(game?._id) || game?.id || null,
      gameTeamId: toStringId(gameTeam?._id) || null,
    })
  }
}
