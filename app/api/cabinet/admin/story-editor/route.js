import { NextResponse } from 'next/server'

import {
  loadAdminStoryContext,
  normalizeStringId,
  readJsonPayload,
} from '@app/api/cabinet/_lib/storyApi'

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
    endingId: normalizeText(action?.endingId, 100) || null,
    resultMessageRich: normalizeText(action?.resultMessageRich, 50000),
  }))

const normalizeStoryNodes = (nodes) =>
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
        hiddenUntilUnlocked: node?.visibility?.hiddenUntilUnlocked !== false,
      },
      scoring: {
        scoreForComplete: normalizeNumber(node?.scoring?.scoreForComplete, 0),
      },
      clues: normalizeClues(node?.clues),
      codes: normalizeCodes(node?.codes),
      actions: normalizeActions(node?.actions),
    }))
    .filter((node) => node.id)

const normalizeStoryEdges = (edges, nodeIds) =>
  (Array.isArray(edges) ? edges : [])
    .map((edge, index) => ({
      id: normalizeText(edge?.id, 100) || `edge-${index + 1}`,
      fromNodeId: normalizeText(edge?.fromNodeId, 100),
      toNodeId: normalizeText(edge?.toNodeId, 100),
      type: ['unlock', 'requires_item', 'ending'].includes(edge?.type)
        ? edge.type
        : 'unlock',
      itemId: normalizeText(edge?.itemId, 100) || null,
      actionId: normalizeText(edge?.actionId, 100) || null,
      codeId: normalizeText(edge?.codeId, 100) || null,
    }))
    .filter(
      (edge) =>
        edge.id &&
        edge.fromNodeId &&
        edge.toNodeId &&
        nodeIds.has(edge.fromNodeId) &&
        nodeIds.has(edge.toNodeId) &&
        edge.fromNodeId !== edge.toNodeId,
    )

const normalizeStoryEndings = (endings) =>
  (Array.isArray(endings) ? endings : [])
    .map((ending, index) => ({
      id: normalizeText(ending?.id, 100) || `ending-${index + 1}`,
      title: normalizeText(ending?.title, 300),
      type: ['success', 'failed', 'neutral', 'secret'].includes(ending?.type)
        ? ending.type
        : 'success',
      descriptionRich: normalizeText(ending?.descriptionRich, 50000),
      media: normalizeMedia(ending?.media),
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
  },
})

export async function GET(request) {
  try {
    const context = await loadAdminStoryContext({ request })
    if (context.response) {
      return context.response
    }

    return NextResponse.json({
      success: true,
      data: buildEditorPayload(context.game),
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

    const storyConfig = payload?.storyConfig || {}
    const storyNodes = normalizeStoryNodes(payload?.storyNodes)
    const nodeIds = new Set(storyNodes.map((node) => node.id))
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
      storyItems: normalizeStoryItems(payload?.storyItems),
      storyNodes,
      storyEdges: normalizeStoryEdges(payload?.storyEdges, nodeIds),
      storyEndings: normalizeStoryEndings(payload?.storyEndings),
    }

    const Games = context.db.model('Games')
    const updatedGame = await Games.findByIdAndUpdate(
      context.game._id,
      { $set: update },
      { new: true },
    )

    return NextResponse.json({
      success: true,
      data: buildEditorPayload(updatedGame),
    })
  } catch (error) {
    console.error('Failed to save story editor data', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить story-квест' },
      { status: 500 },
    )
  }
}
