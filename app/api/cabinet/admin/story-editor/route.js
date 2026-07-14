import { NextResponse } from 'next/server'

import {
  loadAdminStoryContext,
  normalizeStringId,
  readJsonPayload,
} from '@app/api/cabinet/_lib/storyApi'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import { getStoryValidationErrors } from '@helpers/isGameHaveErrors'

const normalizeText = (value, maxLength = 4000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const normalizeStringArray = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item, 200))
    .filter(Boolean)

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const normalizeBoolean = (value, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

const normalizeMedia = (media) =>
  (Array.isArray(media) ? media : []).map((item, index) => ({
    id: normalizeText(item?.id, 100) || `media-${index + 1}`,
    type: ['image', 'audio', 'video'].includes(item?.type) ? item.type : 'image',
    url: normalizeText(item?.url, 2000),
    mime: normalizeText(item?.mime, 200),
    size: normalizeNumber(item?.size, 0),
    duration: normalizeNumber(item?.duration, 0),
    path: normalizeText(item?.path, 2000),
    title: normalizeText(item?.title, 300),
  }))

const normalizeStoryItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: normalizeText(item?.id, 100) || `item-${index + 1}`,
      title: normalizeText(item?.title, 300),
      image: normalizeText(item?.image, 2000),
      descriptionRich: normalizeText(item?.descriptionRich, 50000),
      media: normalizeMedia(item?.media),
      position: {
        x: normalizeNumber(item?.position?.x, 80 + index * 48),
        y: normalizeNumber(item?.position?.y, 80 + index * 48),
      },
      consumableOnUse: normalizeBoolean(item?.consumableOnUse, false),
      hiddenUntilObtained: item?.hiddenUntilObtained !== false,
    }))
    .filter((item) => item.id)

const normalizeClues = (clues) =>
  (Array.isArray(clues) ? clues : []).map((clue, index) => ({
    id: normalizeText(clue?.id, 100) || `clue-${index + 1}`,
    title: normalizeText(clue?.title, 300),
    contentRich: normalizeText(clue?.contentRich, 50000),
    media: normalizeMedia(clue?.media),
    scorePenalty: normalizeNumber(clue?.scorePenalty, 0),
  }))

const normalizeCodes = (codes) =>
  (Array.isArray(codes) ? codes : []).map((code, index) => ({
    id: normalizeText(code?.id, 100) || `code-${index + 1}`,
    code: normalizeText(code?.code, 300),
    type: ['complete', 'bonus', 'effect'].includes(code?.type)
      ? code.type
      : 'complete',
    scoreBonus: normalizeNumber(code?.scoreBonus, 0),
    scorePenalty: normalizeNumber(code?.scorePenalty, 0),
    requiredItemIds: normalizeStringArray(code?.requiredItemIds),
    grantsItemIds: normalizeStringArray(code?.grantsItemIds),
    consumesItemIds: normalizeStringArray(code?.consumesItemIds),
    unlocksNodeIds: normalizeStringArray(code?.unlocksNodeIds),
    completesNode: code?.completesNode !== false,
    repeatable: normalizeBoolean(code?.repeatable, false),
    endingId: normalizeText(code?.endingId, 100) || null,
    resultMessageRich: normalizeText(code?.resultMessageRich, 50000),
  }))

const normalizeActions = (actions) =>
  (Array.isArray(actions) ? actions : []).map((action, index) => ({
    id: normalizeText(action?.id, 100) || `action-${index + 1}`,
    label: normalizeText(action?.label, 300),
    descriptionRich: normalizeText(action?.descriptionRich, 50000),
    requiredItemIds: normalizeStringArray(action?.requiredItemIds),
    grantsItemIds: normalizeStringArray(action?.grantsItemIds),
    consumesItemIds: normalizeStringArray(action?.consumesItemIds),
    unlocksNodeIds: normalizeStringArray(action?.unlocksNodeIds),
    scoreBonus: normalizeNumber(action?.scoreBonus, 0),
    scorePenalty: normalizeNumber(action?.scorePenalty, 0),
    completesNode: normalizeBoolean(action?.completesNode, false),
    repeatable: normalizeBoolean(action?.repeatable, false),
    endingId: normalizeText(action?.endingId, 100) || null,
    resultMessageRich: normalizeText(action?.resultMessageRich, 50000),
  }))

const normalizeStoryNodes = (nodes, allowedAgentIds = null) =>
  (Array.isArray(nodes) ? nodes : [])
    .map((node, index) => ({
      id: normalizeText(node?.id, 100) || `node-${index + 1}`,
      title: normalizeText(node?.title, 300),
      descriptionRich: normalizeText(node?.descriptionRich, 50000),
      media: normalizeMedia(node?.media),
      coordinates: {
        latitude:
          node?.coordinates?.latitude === null
            ? null
            : normalizeNumber(node?.coordinates?.latitude, null),
        longitude:
          node?.coordinates?.longitude === null
            ? null
            : normalizeNumber(node?.coordinates?.longitude, null),
        radius:
          node?.coordinates?.radius === null
            ? null
            : normalizeNumber(node?.coordinates?.radius, null),
      },
      position: {
        x: normalizeNumber(node?.position?.x, 80 + index * 48),
        y: normalizeNumber(node?.position?.y, 80 + index * 48),
      },
      visibility: {
        startVisible: normalizeBoolean(node?.visibility?.startVisible, false),
        requiredNodeIds: normalizeStringArray(node?.visibility?.requiredNodeIds),
        requiredItemIds: normalizeStringArray(node?.visibility?.requiredItemIds),
        requiredInputMode: ['any', 'count'].includes(
          node?.visibility?.requiredInputMode,
        )
          ? node.visibility.requiredInputMode
          : 'all',
        requiredInputCount: Math.max(
          1,
          Math.trunc(normalizeNumber(node?.visibility?.requiredInputCount, 1)),
        ),
        hiddenUntilUnlocked: node?.visibility?.hiddenUntilUnlocked !== false,
      },
      scoring: {
        scoreForComplete: normalizeNumber(node?.scoring?.scoreForComplete, 0),
      },
      agentUserIds: normalizeStringArray(node?.agentUserIds).filter(
        (agentUserId) =>
          !allowedAgentIds || allowedAgentIds.has(agentUserId),
      ),
      clues: normalizeClues(node?.clues),
      codes: normalizeCodes(node?.codes),
      actions: normalizeActions(node?.actions),
    }))
    .filter((node) => node.id)

const normalizeStoryEdges = (edges, nodeIds, itemIds) =>
  (Array.isArray(edges) ? edges : [])
    .map((edge, index) => ({
      id: normalizeText(edge?.id, 100) || `edge-${index + 1}`,
      fromNodeId: normalizeText(edge?.fromNodeId, 100) || null,
      fromItemId: normalizeText(edge?.fromItemId, 100) || null,
      toNodeId: normalizeText(edge?.toNodeId, 100),
      type: [
        'required_node',
        'required_item',
        'unlock',
        'requires_item',
        'ending',
      ].includes(edge?.type)
        ? edge.type === 'unlock'
          ? 'required_node'
          : edge.type === 'requires_item'
            ? 'required_item'
            : edge.type
        : edge?.fromItemId
          ? 'required_item'
          : 'required_node',
      itemId: normalizeText(edge?.itemId, 100) || null,
      actionId: normalizeText(edge?.actionId, 100) || null,
      codeId: normalizeText(edge?.codeId, 100) || null,
    }))
    .filter(
      (edge) =>
        edge.id &&
        (edge.fromNodeId || edge.fromItemId) &&
        edge.toNodeId &&
        (!edge.fromNodeId || nodeIds.has(edge.fromNodeId)) &&
        (!edge.fromItemId || itemIds.has(edge.fromItemId)) &&
        nodeIds.has(edge.toNodeId) &&
        edge.fromNodeId !== edge.toNodeId,
    )

const syncNodeVisibilityFromEdges = (nodes, edges) => {
  const requiredNodeIdsByNode = new Map()
  const requiredItemIdsByNode = new Map()

  edges.forEach((edge) => {
    if (!edge?.toNodeId) return
    if (edge.type === 'required_item' && edge.fromItemId) {
      const items = requiredItemIdsByNode.get(edge.toNodeId) || new Set()
      items.add(edge.fromItemId)
      requiredItemIdsByNode.set(edge.toNodeId, items)
      return
    }
    if (edge.fromNodeId) {
      const nodesSet = requiredNodeIdsByNode.get(edge.toNodeId) || new Set()
      nodesSet.add(edge.fromNodeId)
      requiredNodeIdsByNode.set(edge.toNodeId, nodesSet)
    }
  })

  return nodes.map((node) => ({
    ...node,
    visibility: {
      ...node.visibility,
      requiredNodeIds: Array.from(requiredNodeIdsByNode.get(node.id) || []),
      requiredItemIds: Array.from(requiredItemIdsByNode.get(node.id) || []),
    },
  }))
}

const normalizeStoryEndings = (endings) =>
  (Array.isArray(endings) ? endings : [])
    .map((ending, index) => ({
      id: normalizeText(ending?.id, 100) || `ending-${index + 1}`,
      title: normalizeText(ending?.title, 300),
      type: ['success', 'failed', 'neutral', 'secret'].includes(ending?.type)
        ? ending.type
        : 'success',
      manualOnly: normalizeBoolean(ending?.manualOnly, false),
      descriptionRich: normalizeText(ending?.descriptionRich, 50000),
      media: normalizeMedia(ending?.media),
      position: {
        x: normalizeNumber(ending?.position?.x, 420 + index * 48),
        y: normalizeNumber(ending?.position?.y, 140 + index * 88),
      },
      conditions: {
        minScore:
          ending?.conditions?.minScore === null ||
          ending?.conditions?.minScore === ''
            ? null
            : normalizeNumber(ending?.conditions?.minScore, null),
        requiredItemIds: normalizeStringArray(
          ending?.conditions?.requiredItemIds,
        ),
        requiredCompletedNodeIds: normalizeStringArray(
          ending?.conditions?.requiredCompletedNodeIds,
        ),
      },
    }))
    .filter((ending) => ending.id)

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

const STORY_EDITOR_LOCKED_STATUSES = new Set(['started', 'finished', 'closed'])

const enrichGameAgents = async (db, game) => {
  const baseGame = game?.toObject?.() || game || {}
  const agentUserIds = Array.from(
    new Set(
      (Array.isArray(baseGame?.agents) ? baseGame.agents : [])
        .map((agent) => normalizeStringId(agent?.userId ?? agent?.id ?? agent))
        .filter(Boolean),
    ),
  )
  if (agentUserIds.length === 0) {
    return { ...baseGame, agents: [] }
  }

  const Users = db.model('Users')
  const users = await Users.find({ _id: { $in: agentUserIds } })
    .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
    .lean()
  const usersById = new Map(users.map((user) => [normalizeStringId(user?._id), user]))

  return {
    ...baseGame,
    agents: (Array.isArray(baseGame?.agents) ? baseGame.agents : []).map(
      (agent) => {
        const userId = normalizeStringId(agent?.userId ?? agent?.id ?? agent)
        const user = usersById.get(userId)
        return {
          userId,
          active: agent?.active !== false,
          name: user?.name || '',
          username: user?.username || '',
          telegramId: user?.telegramId || '',
        }
      },
    ),
  }
}

const buildEditorPayload = (game) => ({
  game: {
    id: normalizeStringId(game?._id ?? game?.id),
    name: normalizeText(game?.name),
    status: normalizeText(game?.status),
    type: normalizeText(game?.type),
    storyConfig: {
      nodeLabel: normalizeText(game?.storyConfig?.nodeLabel, 100) || 'Локация',
      startMode:
        game?.storyConfig?.startMode === 'individual' ? 'individual' : 'common',
      hideTotalNodes: game?.storyConfig?.hideTotalNodes !== false,
      hideTotalItems: game?.storyConfig?.hideTotalItems !== false,
      showInventory: game?.storyConfig?.showInventory !== false,
      showScoreToTeam: Boolean(game?.storyConfig?.showScoreToTeam),
      showFinalHistoryToTeam: Boolean(game?.storyConfig?.showFinalHistoryToTeam),
    },
    storyItems: Array.isArray(game?.storyItems) ? game.storyItems : [],
    storyNodes: Array.isArray(game?.storyNodes) ? game.storyNodes : [],
    storyEdges: Array.isArray(game?.storyEdges) ? game.storyEdges : [],
    storyEndings: Array.isArray(game?.storyEndings) ? game.storyEndings : [],
    agents: Array.isArray(game?.agents) ? game.agents : [],
    validationErrors: getStoryValidationErrors(game),
  },
})

export async function GET(request) {
  try {
    const context = await loadAdminStoryContext({ request })
    if (context.response) {
      return context.response
    }

    const enrichedGame = await enrichGameAgents(context.db, context.game)

    return NextResponse.json({
      success: true,
      data: buildEditorPayload(enrichedGame),
    })
  } catch (error) {
    console.error('Failed to fetch story editor data', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить редактор story-квеста' },
      { status: 500 },
    )
  }
}

export async function PATCH(request) {
  try {
    const payload = await readJsonPayload(request)
    const context = await loadAdminStoryContext({
      request,
      gameIdOverride: payload?.gameId,
    })
    if (context.response) {
      return context.response
    }

    const gameStatus = normalizeText(context.game?.status).toLowerCase()
    if (STORY_EDITOR_LOCKED_STATUSES.has(gameStatus)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Сценарий уже опубликован для игры и защищён от изменений. Создайте копию игры для новой версии.',
          code: 'story_scenario_locked',
        },
        { status: 409 },
      )
    }

    const storyConfig = payload?.storyConfig || {}
    const beforeHistoryState = await fetchGameHistoryState({
      db: context.db,
      gameId: normalizeStringId(context.game?._id),
      game: context.game?.toObject?.() || context.game,
    })
    const allowedAgentIds = new Set(
      (Array.isArray(context.game?.agents) ? context.game.agents : [])
        .map((agent) => normalizeStringId(agent?.userId ?? agent?.id ?? agent))
        .filter(Boolean),
    )
    const normalizedStoryNodes = normalizeStoryNodes(
      payload?.storyNodes,
      allowedAgentIds,
    )
    const storyItems = normalizeStoryItems(payload?.storyItems)
    const nodeIds = new Set(normalizedStoryNodes.map((node) => node.id))
    const itemIds = new Set(storyItems.map((item) => item.id))
    const storyEdges = normalizeStoryEdges(payload?.storyEdges, nodeIds, itemIds)
    const storyNodes = syncNodeVisibilityFromEdges(
      normalizedStoryNodes,
      storyEdges,
    )
    const update = {
      type: 'story',
      storyConfig: {
        nodeLabel: normalizeText(storyConfig?.nodeLabel, 100) || 'Локация',
        startMode:
          storyConfig?.startMode === 'individual' ? 'individual' : 'common',
        hideTotalNodes: storyConfig?.hideTotalNodes !== false,
        hideTotalItems: storyConfig?.hideTotalItems !== false,
        showInventory: storyConfig?.showInventory !== false,
        showScoreToTeam: Boolean(storyConfig?.showScoreToTeam),
        showFinalHistoryToTeam: Boolean(storyConfig?.showFinalHistoryToTeam),
      },
      storyItems,
      storyNodes,
      storyEdges,
      storyEndings: normalizeStoryEndings(payload?.storyEndings),
    }

    const Games = context.db.model('Games')
    const updatedGame = await Games.findByIdAndUpdate(
      context.game._id,
      { $set: update },
      { new: true },
    )

    const afterHistoryState = await fetchGameHistoryState({
      db: context.db,
      gameId: normalizeStringId(context.game?._id),
      game: updatedGame?.toObject?.() || updatedGame,
    })
    await recordGameHistoryEntry({
      db: context.db,
      gameId: normalizeStringId(context.game?._id),
      location:
        typeof context.game?.location === 'string'
          ? context.game.location.trim().toLowerCase()
          : null,
      actionType: 'game_updated',
      entityScope: 'game',
      actor: buildHistoryActorFromSession(context.session),
      beforeState: beforeHistoryState,
      afterState: afterHistoryState,
      snapshot: buildGameHistorySnapshot(afterHistoryState),
      context: {
        summary: 'Story-конфигурация игры обновлена',
      },
    })

    const enrichedGame = await enrichGameAgents(context.db, updatedGame)

    return NextResponse.json({
      success: true,
      data: buildEditorPayload(enrichedGame),
    })
  } catch (error) {
    console.error('Failed to save story editor data', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить story-квест' },
      { status: 500 },
    )
  }
}
