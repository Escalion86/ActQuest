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
import sanitize from '@helpers/sanitize'

const normalizeText = (value, maxLength = 4000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const normalizeRichText = (value, maxLength = 50000) =>
  sanitize(normalizeText(value, maxLength))

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

const normalizeStoryEdges = (edges, nodeIds, itemIds, nodesById) =>
  (Array.isArray(edges) ? edges : [])
    .map((edge, index) => {
      const fromNodeId = normalizeText(edge?.fromNodeId, 100) || null
      const fromItemId = normalizeText(edge?.fromItemId, 100) || null
      const sourceNode = fromNodeId ? nodesById.get(fromNodeId) : null
      const actionIds = new Set(
        (Array.isArray(sourceNode?.actions) ? sourceNode.actions : []).map(
          (action) => action.id,
        ),
      )
      const codeIds = new Set(
        (Array.isArray(sourceNode?.codes) ? sourceNode.codes : []).map(
          (code) => code.id,
        ),
      )
      const itemId = normalizeText(edge?.itemId, 100) || null
      const actionId = normalizeText(edge?.actionId, 100) || null
      const codeId = normalizeText(edge?.codeId, 100) || null

      return {
        id: normalizeText(edge?.id, 100) || `edge-${index + 1}`,
        fromNodeId,
        fromItemId,
        toNodeId: normalizeText(edge?.toNodeId, 100),
        type: fromItemId ? 'required_item' : 'required_node',
        itemId: itemId && itemIds.has(itemId) ? itemId : null,
        actionId:
          fromNodeId && actionId && actionIds.has(actionId) ? actionId : null,
        codeId: fromNodeId && codeId && codeIds.has(codeId) ? codeId : null,
      }
    })
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

const filterKnownIds = (values, allowedIds) =>
  normalizeStringArray(values).filter((id) => allowedIds.has(id))

const normalizeInvestigationCharacters = (characters, nodeIds) =>
  (Array.isArray(characters) ? characters : []).map((character, index) => {
    const defaultNodeId = normalizeText(character?.defaultNodeId, 100)
    return {
      id: normalizeText(character?.id, 100) || `character-${index + 1}`,
      title: normalizeText(character?.title, 300),
      subtitle: normalizeText(character?.subtitle, 300),
      descriptionRich: normalizeRichText(character?.descriptionRich),
      image: normalizeText(character?.image, 2000),
      media: normalizeMedia(character?.media),
      startVisible: normalizeBoolean(character?.startVisible, false),
      hiddenUntilUnlocked: character?.hiddenUntilUnlocked !== false,
      defaultNodeId: nodeIds.has(defaultNodeId) ? defaultNodeId : null,
      position: {
        x: normalizeNumber(character?.position?.x, 80 + index * 48),
        y: normalizeNumber(character?.position?.y, 80 + index * 48),
      },
    }
  })

const normalizeInvestigationTopics = (topics) =>
  (Array.isArray(topics) ? topics : []).map((topic, index) => ({
    id: normalizeText(topic?.id, 100) || `topic-${index + 1}`,
    title: normalizeText(topic?.title, 300),
    descriptionRich: normalizeRichText(topic?.descriptionRich),
    icon: normalizeText(topic?.icon, 2000),
    startVisible: normalizeBoolean(topic?.startVisible, false),
    hiddenUntilUnlocked: topic?.hiddenUntilUnlocked !== false,
    position: {
      x: normalizeNumber(topic?.position?.x, 80 + index * 48),
      y: normalizeNumber(topic?.position?.y, 80 + index * 48),
    },
  }))

const normalizeInvestigationEvidence = (evidence) =>
  (Array.isArray(evidence) ? evidence : []).map((item, index) => ({
    id: normalizeText(item?.id, 100) || `evidence-${index + 1}`,
    title: normalizeText(item?.title, 300),
    descriptionRich: normalizeRichText(item?.descriptionRich),
    media: normalizeMedia(item?.media),
    tags: normalizeStringArray(item?.tags).slice(0, 50),
    weight: normalizeNumber(item?.weight, 0),
    isKey: normalizeBoolean(item?.isKey, false),
    hiddenUntilDiscovered: item?.hiddenUntilDiscovered !== false,
  }))

const normalizeInvestigationInteractions = ({
  interactions,
  nodeIds,
  itemIds,
  characterIds,
  topicIds,
  evidenceIds,
}) => {
  const interactionIds = new Set(
    (Array.isArray(interactions) ? interactions : [])
      .map((interaction) => normalizeText(interaction?.id, 100))
      .filter(Boolean),
  )
  return (Array.isArray(interactions) ? interactions : []).map(
    (interaction, index) => {
      const locationId = normalizeText(interaction?.locationId, 100)
      const characterId = normalizeText(interaction?.characterId, 100)
      const topicId = normalizeText(interaction?.topicId, 100)
      const minElapsedMinutes = Number(interaction?.conditions?.minElapsedMinutes)
      const maxElapsedMinutes = Number(interaction?.conditions?.maxElapsedMinutes)
      const endingId = normalizeText(interaction?.effects?.endingId, 100)
      return {
        id:
          normalizeText(interaction?.id, 100) || `interaction-${index + 1}`,
        kind: ['question', 'examine', 'analysis', 'system'].includes(
          interaction?.kind,
        )
          ? interaction.kind
          : 'question',
        locationId: nodeIds.has(locationId) ? locationId : '',
        characterId: characterIds.has(characterId) ? characterId : null,
        topicId: topicIds.has(topicId) ? topicId : null,
        label: normalizeText(interaction?.label, 300),
        promptRich: normalizeRichText(interaction?.promptRich),
        responseRich: normalizeRichText(interaction?.responseRich),
        media: normalizeMedia(interaction?.media),
        timeCostMinutes: Math.max(
          0,
          normalizeNumber(interaction?.timeCostMinutes, 10),
        ),
        repeatable: normalizeBoolean(interaction?.repeatable, false),
        reapplyEffects: normalizeBoolean(interaction?.reapplyEffects, false),
        conditions: {
          requiredItemIds: filterKnownIds(
            interaction?.conditions?.requiredItemIds,
            itemIds,
          ),
          requiredEvidenceIds: filterKnownIds(
            interaction?.conditions?.requiredEvidenceIds,
            evidenceIds,
          ),
          requiredTopicIds: filterKnownIds(
            interaction?.conditions?.requiredTopicIds,
            topicIds,
          ),
          requiredCharacterIds: filterKnownIds(
            interaction?.conditions?.requiredCharacterIds,
            characterIds,
          ),
          requiredInteractionIds: filterKnownIds(
            interaction?.conditions?.requiredInteractionIds,
            interactionIds,
          ),
          requiredFlagIds: normalizeStringArray(
            interaction?.conditions?.requiredFlagIds,
          ),
          minElapsedMinutes: Number.isFinite(minElapsedMinutes)
            ? Math.max(0, minElapsedMinutes)
            : null,
          maxElapsedMinutes: Number.isFinite(maxElapsedMinutes)
            ? Math.max(0, maxElapsedMinutes)
            : null,
        },
        effects: {
          grantsItemIds: filterKnownIds(
            interaction?.effects?.grantsItemIds,
            itemIds,
          ),
          consumesItemIds: filterKnownIds(
            interaction?.effects?.consumesItemIds,
            itemIds,
          ),
          grantsEvidenceIds: filterKnownIds(
            interaction?.effects?.grantsEvidenceIds,
            evidenceIds,
          ),
          unlocksNodeIds: filterKnownIds(
            interaction?.effects?.unlocksNodeIds,
            nodeIds,
          ),
          unlocksCharacterIds: filterKnownIds(
            interaction?.effects?.unlocksCharacterIds,
            characterIds,
          ),
          unlocksTopicIds: filterKnownIds(
            interaction?.effects?.unlocksTopicIds,
            topicIds,
          ),
          setsFlagIds: normalizeStringArray(interaction?.effects?.setsFlagIds),
          scoreBonus: normalizeNumber(interaction?.effects?.scoreBonus, 0),
          scorePenalty: normalizeNumber(interaction?.effects?.scorePenalty, 0),
          endingId: endingId || null,
        },
        journal: {
          title: normalizeText(interaction?.journal?.title, 300),
          summaryRich: normalizeRichText(interaction?.journal?.summaryRich),
          kind: ['testimony', 'evidence', 'observation', 'system'].includes(
            interaction?.journal?.kind,
          )
            ? interaction.journal.kind
            : 'observation',
        },
      }
    },
  )
}

const normalizeInvestigationAccusation = ({
  accusation,
  nodeIds,
  characterIds,
  topicIds,
  interactionIds,
  evidenceIds,
  endingIds,
}) => {
  const motives = (Array.isArray(accusation?.motives)
    ? accusation.motives
    : []
  ).map((motive, index) => ({
    id: normalizeText(motive?.id, 100) || `motive-${index + 1}`,
    title: normalizeText(motive?.title, 500),
  }))
  const motiveIds = new Set(motives.map((motive) => motive.id))
  const normalizeKnownId = (value, allowedIds) => {
    const id = normalizeText(value, 100)
    return allowedIds.has(id) ? id : null
  }
  return {
    enabled: normalizeBoolean(accusation?.enabled, false),
    requiredNodeId: normalizeKnownId(accusation?.requiredNodeId, nodeIds),
    unlockTopicId: normalizeKnownId(accusation?.unlockTopicId, topicIds),
    availability: {
      minKeyEvidence: Math.max(
        0,
        Math.trunc(normalizeNumber(accusation?.availability?.minKeyEvidence, 0)),
      ),
      requiredEvidenceIds: filterKnownIds(
        accusation?.availability?.requiredEvidenceIds,
        evidenceIds,
      ),
      requiredInteractionIds: filterKnownIds(
        accusation?.availability?.requiredInteractionIds,
        interactionIds,
      ),
    },
    culpritCharacterIds: filterKnownIds(
      accusation?.culpritCharacterIds,
      characterIds,
    ),
    motives,
    minSelectableEvidence: Math.max(
      0,
      Math.trunc(normalizeNumber(accusation?.minSelectableEvidence, 0)),
    ),
    maxSelectableEvidence: Math.max(
      0,
      Math.trunc(normalizeNumber(accusation?.maxSelectableEvidence, 5)),
    ),
    correctCulpritId: normalizeKnownId(
      accusation?.correctCulpritId,
      characterIds,
    ),
    correctMotiveId: normalizeKnownId(accusation?.correctMotiveId, motiveIds),
    outcomes: (Array.isArray(accusation?.outcomes)
      ? accusation.outcomes
      : []
    ).map((outcome, index) => ({
      id: normalizeText(outcome?.id, 100) || `outcome-${index + 1}`,
      priority: normalizeNumber(outcome?.priority, 0),
      endingId: normalizeKnownId(outcome?.endingId, endingIds),
      conditions: {
        culprit: ['any', 'correct', 'incorrect'].includes(
          outcome?.conditions?.culprit,
        )
          ? outcome.conditions.culprit
          : 'any',
        motive: ['any', 'correct', 'incorrect'].includes(
          outcome?.conditions?.motive,
        )
          ? outcome.conditions.motive
          : 'any',
        minSelectedEvidence: Math.max(
          0,
          Math.trunc(
            normalizeNumber(outcome?.conditions?.minSelectedEvidence, 0),
          ),
        ),
        minKeyEvidence: Math.max(
          0,
          Math.trunc(normalizeNumber(outcome?.conditions?.minKeyEvidence, 0)),
        ),
        requiredEvidenceIds: filterKnownIds(
          outcome?.conditions?.requiredEvidenceIds,
          evidenceIds,
        ),
        requiredEvidenceTags: normalizeStringArray(
          outcome?.conditions?.requiredEvidenceTags,
        ),
        maxElapsedMinutes:
          outcome?.conditions?.maxElapsedMinutes === null
            ? null
            : normalizeNumber(outcome?.conditions?.maxElapsedMinutes, null),
        maxUsedClues:
          outcome?.conditions?.maxUsedClues === null
            ? null
            : normalizeNumber(outcome?.conditions?.maxUsedClues, null),
      },
    })),
    fallbackEndingId: normalizeKnownId(accusation?.fallbackEndingId, endingIds),
    timeoutEndingId: normalizeKnownId(accusation?.timeoutEndingId, endingIds),
  }
}

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
      experienceMode:
        game?.storyConfig?.experienceMode === 'investigation'
          ? 'investigation'
          : 'quest',
      nodeLabel: normalizeText(game?.storyConfig?.nodeLabel, 100) || 'Локация',
      startMode:
        game?.storyConfig?.startMode === 'individual' ? 'individual' : 'common',
      hideTotalNodes: game?.storyConfig?.hideTotalNodes !== false,
      hideTotalItems: game?.storyConfig?.hideTotalItems !== false,
      showInventory: game?.storyConfig?.showInventory !== false,
      showScoreToTeam: Boolean(game?.storyConfig?.showScoreToTeam),
      showFinalHistoryToTeam: Boolean(game?.storyConfig?.showFinalHistoryToTeam),
      investigation: {
        startNodeId:
          normalizeText(game?.storyConfig?.investigation?.startNodeId, 100) ||
          null,
        startClockMinutes: normalizeNumber(
          game?.storyConfig?.investigation?.startClockMinutes,
          0,
        ),
        deadlineMinutes:
          game?.storyConfig?.investigation?.deadlineMinutes ?? null,
        defaultTravelTimeMinutes: normalizeNumber(
          game?.storyConfig?.investigation?.defaultTravelTimeMinutes,
          10,
        ),
        defaultInteractionTimeMinutes: normalizeNumber(
          game?.storyConfig?.investigation?.defaultInteractionTimeMinutes,
          10,
        ),
        accusationTimeMinutes: normalizeNumber(
          game?.storyConfig?.investigation?.accusationTimeMinutes,
          10,
        ),
        allowFreeReplay:
          game?.storyConfig?.investigation?.allowFreeReplay !== false,
        showClockToTeam:
          game?.storyConfig?.investigation?.showClockToTeam !== false,
        showEvidenceToTeam:
          game?.storyConfig?.investigation?.showEvidenceToTeam !== false,
        autoFailOnDeadline:
          game?.storyConfig?.investigation?.autoFailOnDeadline !== false,
        revealSolutionAfterFinish: Boolean(
          game?.storyConfig?.investigation?.revealSolutionAfterFinish,
        ),
      },
    },
    storyItems: Array.isArray(game?.storyItems) ? game.storyItems : [],
    storyNodes: Array.isArray(game?.storyNodes) ? game.storyNodes : [],
    storyEdges: Array.isArray(game?.storyEdges) ? game.storyEdges : [],
    storyEndings: Array.isArray(game?.storyEndings) ? game.storyEndings : [],
    storyCharacters: Array.isArray(game?.storyCharacters)
      ? game.storyCharacters
      : [],
    storyTopics: Array.isArray(game?.storyTopics) ? game.storyTopics : [],
    storyInteractions: Array.isArray(game?.storyInteractions)
      ? game.storyInteractions
      : [],
    storyEvidence: Array.isArray(game?.storyEvidence) ? game.storyEvidence : [],
    storyAccusation:
      game?.storyAccusation && typeof game.storyAccusation === 'object'
        ? game.storyAccusation
        : {},
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
    const nodesById = new Map(
      normalizedStoryNodes.map((node) => [node.id, node]),
    )
    const itemIds = new Set(storyItems.map((item) => item.id))
    const storyEdges = normalizeStoryEdges(
      payload?.storyEdges,
      nodeIds,
      itemIds,
      nodesById,
    )
    const storyNodes = syncNodeVisibilityFromEdges(
      normalizedStoryNodes,
      storyEdges,
    )
    const storyEndings = normalizeStoryEndings(payload?.storyEndings)
    const endingIds = new Set(storyEndings.map((ending) => ending.id))
    const storyCharacters = normalizeInvestigationCharacters(
      payload?.storyCharacters,
      nodeIds,
    )
    const storyTopics = normalizeInvestigationTopics(payload?.storyTopics)
    const storyEvidence = normalizeInvestigationEvidence(payload?.storyEvidence)
    const characterIds = new Set(
      storyCharacters.map((character) => character.id),
    )
    const topicIds = new Set(storyTopics.map((topic) => topic.id))
    const evidenceIds = new Set(storyEvidence.map((evidence) => evidence.id))
    const storyInteractions = normalizeInvestigationInteractions({
      interactions: payload?.storyInteractions,
      nodeIds,
      itemIds,
      characterIds,
      topicIds,
      evidenceIds,
    })
    const interactionIds = new Set(
      storyInteractions.map((interaction) => interaction.id),
    )
    const storyAccusation = normalizeInvestigationAccusation({
      accusation: payload?.storyAccusation,
      nodeIds,
      characterIds,
      topicIds,
      interactionIds,
      evidenceIds,
      endingIds,
    })
    const investigationConfig = storyConfig?.investigation || {}
    const startNodeId = normalizeText(investigationConfig?.startNodeId, 100)
    const deadlineMinutes = Number(investigationConfig?.deadlineMinutes)
    const update = {
      type: 'story',
      storyConfig: {
        experienceMode:
          storyConfig?.experienceMode === 'investigation'
            ? 'investigation'
            : 'quest',
        nodeLabel: normalizeText(storyConfig?.nodeLabel, 100) || 'Локация',
        startMode:
          storyConfig?.startMode === 'individual' ? 'individual' : 'common',
        hideTotalNodes: storyConfig?.hideTotalNodes !== false,
        hideTotalItems: storyConfig?.hideTotalItems !== false,
        showInventory: storyConfig?.showInventory !== false,
        showScoreToTeam: Boolean(storyConfig?.showScoreToTeam),
        showFinalHistoryToTeam: Boolean(storyConfig?.showFinalHistoryToTeam),
        investigation: {
          startNodeId: nodeIds.has(startNodeId) ? startNodeId : null,
          startClockMinutes: Math.max(
            0,
            normalizeNumber(investigationConfig?.startClockMinutes, 0),
          ),
          deadlineMinutes:
            Number.isFinite(deadlineMinutes) && deadlineMinutes >= 0
              ? deadlineMinutes
              : null,
          defaultTravelTimeMinutes: Math.max(
            0,
            normalizeNumber(
              investigationConfig?.defaultTravelTimeMinutes,
              10,
            ),
          ),
          defaultInteractionTimeMinutes: Math.max(
            0,
            normalizeNumber(
              investigationConfig?.defaultInteractionTimeMinutes,
              10,
            ),
          ),
          accusationTimeMinutes: Math.max(
            0,
            normalizeNumber(investigationConfig?.accusationTimeMinutes, 10),
          ),
          allowFreeReplay: investigationConfig?.allowFreeReplay !== false,
          showClockToTeam: investigationConfig?.showClockToTeam !== false,
          showEvidenceToTeam:
            investigationConfig?.showEvidenceToTeam !== false,
          autoFailOnDeadline:
            investigationConfig?.autoFailOnDeadline !== false,
          revealSolutionAfterFinish: Boolean(
            investigationConfig?.revealSolutionAfterFinish,
          ),
        },
      },
      storyItems,
      storyNodes,
      storyEdges,
      storyEndings,
      storyCharacters,
      storyTopics,
      storyInteractions,
      storyEvidence,
      storyAccusation,
    }

    const Games = context.db.model('Games')
    const updatedGame = await Games.findByIdAndUpdate(
      context.game._id,
      { $set: update },
      { returnDocument: 'after' },
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
