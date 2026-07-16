const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const ENTITY_DEFINITIONS = {
  item: {
    collection: 'storyItems',
    requiredField: 'requiredItemIds',
    producedField: 'grantsItemIds',
    requiredLabel: 'Предмет',
    resultLabel: 'Предмет',
  },
  evidence: {
    collection: 'storyEvidence',
    requiredField: 'requiredEvidenceIds',
    producedField: 'grantsEvidenceIds',
    requiredLabel: 'Улика',
    resultLabel: 'Улика',
  },
  topic: {
    collection: 'storyTopics',
    requiredField: 'requiredTopicIds',
    producedField: 'unlocksTopicIds',
    requiredLabel: 'Тема',
    resultLabel: 'Тема',
  },
  character: {
    collection: 'storyCharacters',
    requiredField: 'requiredCharacterIds',
    producedField: 'unlocksCharacterIds',
    requiredLabel: 'Персонаж',
    resultLabel: 'Персонаж',
  },
  flag: {
    collection: null,
    requiredField: 'requiredFlagIds',
    producedField: 'setsFlagIds',
    requiredLabel: 'Условие',
    resultLabel: 'Условие',
  },
}

const INTERACTION_KIND_LABELS = {
  question: 'Вопрос',
  examine: 'Осмотр',
  analysis: 'Анализ',
  system: 'Системное',
}

const ENDING_TYPE_LABELS = {
  success: 'Успех',
  neutral: 'Нейтральная',
  failed: 'Провал',
  secret: 'Секретная',
}

const ENTITY_MAP_KEYS = {
  item: 'items',
  evidence: 'evidence',
  topic: 'topics',
  character: 'characters',
}

const entityLabel = (entry) => entry?.title || entry?.label || 'Без названия'

const createEntityMaps = (game) => {
  const buildMap = (value) =>
    new Map(normalizeArray(value).map((entry) => [entry.id, entityLabel(entry)]))

  return {
    locations: buildMap(game?.storyNodes),
    items: buildMap(game?.storyItems),
    characters: buildMap(game?.storyCharacters),
    topics: buildMap(game?.storyTopics),
    evidence: buildMap(game?.storyEvidence),
    interactions: buildMap(game?.storyInteractions),
    endings: buildMap(game?.storyEndings),
  }
}

const resolveEntityLabel = (maps, type, id) => {
  if (type === 'flag') return 'Служебное условие'
  const mapKey = ENTITY_MAP_KEYS[type]
  return maps[mapKey]?.get(id) || 'Неизвестная сущность'
}

const buildFlagRelations = (game) => {
  const relations = new Map()
  const addRelation = (id, role, label) => {
    const current = relations.get(id) || { producers: [], consumers: [] }
    if (!current[role].includes(label)) current[role].push(label)
    relations.set(id, current)
  }

  normalizeArray(game?.storyInteractions).forEach((interaction) => {
    const label = entityLabel(interaction)
    normalizeArray(interaction.effects?.setsFlagIds).forEach((id) => {
      addRelation(id, 'producers', label)
    })
    normalizeArray(interaction.conditions?.requiredFlagIds).forEach((id) => {
      addRelation(id, 'consumers', label)
    })
  })

  return relations
}

const joinAlternatives = (labels) => labels.join(' или ')

const buildReferenceLabel = (
  maps,
  type,
  id,
  prefix,
  { flagRelations, role } = {},
) => {
  if (type === 'flag') {
    const relations = flagRelations?.get(id) || { producers: [], consumers: [] }
    const relatedLabels = role === 'required'
      ? relations.producers
      : relations.consumers
    const relatedLabel = joinAlternatives(relatedLabels)

    if (!relatedLabel) {
      return { label: 'Условие без связанного действия', shortLabel: 'Условие' }
    }

    return role === 'required'
      ? { label: `После: ${relatedLabel}`, shortLabel: relatedLabel }
      : { label: `Условие для: ${relatedLabel}`, shortLabel: relatedLabel }
  }

  const shortLabel = resolveEntityLabel(maps, type, id)
  return { label: `${prefix}: ${shortLabel}`, shortLabel }
}

const buildReferenceIndex = (game, maps) => {
  const producers = new Map()
  const consumers = new Map()
  const referencesByInteraction = new Map()
  const flagRelations = buildFlagRelations(game)

  const addIndexEntry = (index, key, interactionId) => {
    const current = index.get(key) || []
    if (!current.includes(interactionId)) current.push(interactionId)
    index.set(key, current)
  }

  normalizeArray(game?.storyInteractions).forEach((interaction) => {
    const required = []
    const results = []
    const conditions = interaction.conditions || {}
    const effects = interaction.effects || {}

    Object.entries(ENTITY_DEFINITIONS).forEach(([type, definition]) => {
      normalizeArray(conditions[definition.requiredField]).forEach((id) => {
        const refKey = `${type}:${id}`
        const referenceLabel = buildReferenceLabel(
          maps,
          type,
          id,
          definition.requiredLabel,
          { flagRelations, role: 'required' },
        )
        required.push({
          refKey,
          type,
          id,
          ...referenceLabel,
          tone: 'condition',
        })
        addIndexEntry(consumers, refKey, interaction.id)
      })
      normalizeArray(effects[definition.producedField]).forEach((id) => {
        const refKey = `${type}:${id}`
        const hasVisibleConsumer = type !== 'flag' ||
          (flagRelations.get(id)?.consumers.length ?? 0) > 0
        const referenceLabel = buildReferenceLabel(
          maps,
          type,
          id,
          definition.resultLabel,
          { flagRelations, role: 'result' },
        )
        if (hasVisibleConsumer) {
          results.push({
            refKey,
            type,
            id,
            ...referenceLabel,
            tone: type === 'item' || type === 'evidence' ? type : 'unlock',
          })
        }
        addIndexEntry(producers, refKey, interaction.id)
      })
    })

    normalizeArray(conditions.requiredInteractionIds).forEach((id) => {
      required.push({
        refKey: `interaction:${id}`,
        type: 'interaction',
        id,
        label: `После: ${maps.interactions.get(id) || 'Неизвестное взаимодействие'}`,
        shortLabel: maps.interactions.get(id) || 'Неизвестное взаимодействие',
        tone: 'condition',
      })
      addIndexEntry(consumers, `interaction:${id}`, interaction.id)
    })

    normalizeArray(effects.unlocksNodeIds).forEach((id) => {
      results.push({
        refKey: `location:${id}`,
        type: 'location',
        id,
        label: `Локация: ${maps.locations.get(id) || 'Неизвестная локация'}`,
        shortLabel: maps.locations.get(id) || 'Неизвестная локация',
        tone: 'unlock',
      })
      addIndexEntry(producers, `location:${id}`, interaction.id)
    })

    if (effects.endingId) {
      results.push({
        refKey: `ending:${effects.endingId}`,
        type: 'ending',
        id: effects.endingId,
        label: `Концовка: ${maps.endings.get(effects.endingId) || 'Неизвестная концовка'}`,
        shortLabel: maps.endings.get(effects.endingId) || 'Неизвестная концовка',
        tone: 'ending',
      })
      addIndexEntry(producers, `ending:${effects.endingId}`, interaction.id)
    }

    referencesByInteraction.set(interaction.id, { required, results })
  })

  return { producers, consumers, referencesByInteraction }
}

const buildSemanticEdges = (game, index) => {
  const edges = []
  const edgeKeys = new Set()
  const addEdge = (edge) => {
    const key = `${edge.source}:${edge.target}:${edge.relation}:${edge.refKey || ''}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ id: `edge:${key}`, ...edge })
  }

  normalizeArray(game?.storyInteractions).forEach((interaction) => {
    normalizeArray(interaction.conditions?.requiredInteractionIds).forEach((sourceId) => {
      addEdge({
        source: sourceId,
        target: interaction.id,
        relation: 'interaction',
        label: 'после действия',
        persistent: true,
        refKey: `interaction:${sourceId}`,
      })
    })

    Object.entries(ENTITY_DEFINITIONS).forEach(([type, definition]) => {
      normalizeArray(interaction.conditions?.[definition.requiredField]).forEach((id) => {
        const refKey = `${type}:${id}`
        normalizeArray(index.producers.get(refKey)).forEach((sourceId) => {
          addEdge({
            source: sourceId,
            target: interaction.id,
            relation: type,
            label: resolveEntityLabel(index.maps, type, id),
            persistent: false,
            refKey,
          })
        })
      })
    })
  })

  return edges
}

const collectDiagnostics = (game, maps) => {
  const diagnostics = []
  const check = (interaction, ids, map, label) => {
    normalizeArray(ids).forEach((id) => {
      if (!map.has(id)) {
        diagnostics.push({
          interactionId: interaction.id,
          message: `${entityLabel(interaction)}: не найдена сущность «${id}» (${label}).`,
        })
      }
    })
  }

  normalizeArray(game?.storyInteractions).forEach((interaction) => {
    if (!maps.locations.has(interaction.locationId)) {
      diagnostics.push({
        interactionId: interaction.id,
        message: `${entityLabel(interaction)}: не выбрана существующая локация.`,
      })
    }
    check(interaction, interaction.conditions?.requiredInteractionIds, maps.interactions, 'взаимодействие')
    check(interaction, interaction.conditions?.requiredItemIds, maps.items, 'предмет')
    check(interaction, interaction.conditions?.requiredEvidenceIds, maps.evidence, 'улика')
    check(interaction, interaction.conditions?.requiredTopicIds, maps.topics, 'тема')
    check(interaction, interaction.conditions?.requiredCharacterIds, maps.characters, 'персонаж')
    check(interaction, interaction.effects?.unlocksNodeIds, maps.locations, 'локация')
    check(interaction, interaction.effects?.unlocksCharacterIds, maps.characters, 'персонаж')
    check(interaction, interaction.effects?.unlocksTopicIds, maps.topics, 'тема')
    if (interaction.effects?.endingId) {
      check(interaction, [interaction.effects.endingId], maps.endings, 'концовка')
    }
  })

  return diagnostics
}

const matchesQuery = (node, query) => {
  if (!query) return true
  const haystack = [
    node.title,
    node.subtitle,
    node.locationTitle,
    ...normalizeArray(node.required).flatMap((entry) => [entry.label, entry.refKey]),
    ...normalizeArray(node.results).flatMap((entry) => [entry.label, entry.refKey]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru-RU')
  return haystack.includes(query.toLocaleLowerCase('ru-RU'))
}

const buildLogicView = (game, maps, index, query) => {
  const interactions = normalizeArray(game?.storyInteractions).map((interaction) => {
    const references = index.referencesByInteraction.get(interaction.id) || {
      required: [],
      results: [],
    }
    return {
      id: interaction.id,
      graphId: `interaction:${interaction.id}`,
      type: 'interaction',
      title: entityLabel(interaction),
      subtitle: [
        maps.characters.get(interaction.characterId),
        maps.topics.get(interaction.topicId),
      ]
        .filter(Boolean)
        .join(' · '),
      locationId: interaction.locationId || '__without_location',
      locationTitle: maps.locations.get(interaction.locationId) || 'Без локации',
      kind: interaction.kind || 'examine',
      kindLabel: INTERACTION_KIND_LABELS[interaction.kind] || interaction.kind || 'Действие',
      timeCostMinutes: Number(interaction.timeCostMinutes) || 0,
      required: references.required,
      results: references.results,
      raw: interaction,
    }
  })

  const matchedIds = new Set(
    interactions.filter((node) => matchesQuery(node, query)).map((node) => node.id),
  )
  const visibleIds = new Set(matchedIds)
  if (query) {
    buildSemanticEdges(game, { ...index, maps }).forEach((edge) => {
      if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
        visibleIds.add(edge.source)
        visibleIds.add(edge.target)
      }
    })
  }

  const visibleInteractions = query
    ? interactions.filter((node) => visibleIds.has(node.id))
    : interactions
  const locationIds = new Set(visibleInteractions.map((node) => node.locationId))
  const locations = [
    ...normalizeArray(game?.storyNodes)
      .filter((location) => locationIds.has(location.id))
      .map((location) => ({
        id: location.id,
        graphId: `location:${location.id}`,
        type: 'location-group',
        title: entityLabel(location),
        startVisible: Boolean(location.visibility?.startVisible),
        interactionCount: visibleInteractions.filter((entry) => entry.locationId === location.id).length,
        raw: location,
      })),
  ]
  if (locationIds.has('__without_location')) {
    locations.push({
      id: '__without_location',
      graphId: 'location:__without_location',
      type: 'location-group',
      title: 'Без локации',
      startVisible: false,
      interactionCount: visibleInteractions.filter((entry) => entry.locationId === '__without_location').length,
      raw: null,
    })
  }

  const visibleInteractionIds = new Set(visibleInteractions.map((node) => node.id))
  const edges = buildSemanticEdges(game, { ...index, maps }).filter(
    (edge) => visibleInteractionIds.has(edge.source) && visibleInteractionIds.has(edge.target),
  )

  return { nodes: [...locations, ...visibleInteractions], edges, matchedIds }
}

const buildLocationsView = (game, _maps) => {
  const locations = normalizeArray(game?.storyNodes).map((location) => ({
    id: location.id,
    graphId: `location:${location.id}`,
    type: 'location',
    title: entityLabel(location),
    subtitle: location.visibility?.startVisible ? 'Доступна в начале' : 'Открывается по сценарию',
    startVisible: Boolean(location.visibility?.startVisible),
    interactionCount: normalizeArray(game?.storyInteractions).filter(
      (interaction) => interaction.locationId === location.id,
    ).length,
    raw: location,
  }))

  const edges = []
  normalizeArray(game?.storyEdges).forEach((edge) => {
    if (!edge.fromNodeId || !edge.toNodeId) return
    edges.push({
      id: `location-edge:${edge.id || `${edge.fromNodeId}:${edge.toNodeId}`}`,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      relation: 'location',
      label: 'переход',
      persistent: true,
    })
  })
  normalizeArray(game?.storyInteractions).forEach((interaction) => {
    normalizeArray(interaction.effects?.unlocksNodeIds).forEach((targetId) => {
      if (!interaction.locationId || interaction.locationId === targetId) return
      edges.push({
        id: `location-unlock:${interaction.id}:${targetId}`,
        source: interaction.locationId,
        target: targetId,
        relation: 'unlock',
        label: entityLabel(interaction),
        persistent: true,
        interactionId: interaction.id,
      })
    })
  })

  return { nodes: locations, edges, matchedIds: new Set() }
}

const describeOutcome = (outcome, maps) => {
  const conditions = outcome?.conditions || {}
  const parts = []
  if (conditions.culprit === 'correct') parts.push('виновник верный')
  if (conditions.culprit === 'incorrect') parts.push('виновник неверный')
  if (conditions.motive === 'correct') parts.push('мотив верный')
  if (conditions.motive === 'incorrect') parts.push('мотив неверный')
  if (Number(conditions.minKeyEvidence) > 0) parts.push(`ключевых улик: ${conditions.minKeyEvidence}+`)
  if (Number(conditions.minSelectedEvidence) > 0) parts.push(`выбрано улик: ${conditions.minSelectedEvidence}+`)
  normalizeArray(conditions.requiredEvidenceIds).forEach((id) => {
    parts.push(maps.evidence.get(id) || 'Неизвестная улика')
  })
  return parts.length > 0 ? parts.join(' · ') : 'Запасной исход'
}

const buildFinalsView = (game, maps) => {
  const accusation = game?.storyAccusation || {}
  const nodes = [{
    id: 'accusation',
    graphId: 'accusation',
    type: 'accusation',
    title: 'Финальное обвинение',
    subtitle: accusation.enabled === false ? 'Отключено' : 'Выбор виновника, мотива и улик',
    raw: accusation,
  }]
  const edges = []

  normalizeArray(accusation.outcomes).forEach((outcome) => {
    nodes.push({
      id: outcome.id,
      graphId: `outcome:${outcome.id}`,
      type: 'outcome',
      title: `Исход · приоритет ${Number(outcome.priority) || 0}`,
      subtitle: describeOutcome(outcome, maps),
      endingId: outcome.endingId,
      raw: outcome,
    })
    edges.push({
      id: `accusation:${outcome.id}`,
      source: 'accusation',
      target: outcome.id,
      relation: 'outcome',
      label: `приоритет ${Number(outcome.priority) || 0}`,
      persistent: true,
    })
  })

  normalizeArray(game?.storyEndings).forEach((ending) => {
    nodes.push({
      id: ending.id,
      graphId: `ending:${ending.id}`,
      type: 'ending',
      title: entityLabel(ending),
      subtitle: ENDING_TYPE_LABELS[ending.type] || 'Тип не указан',
      raw: ending,
    })
  })

  normalizeArray(accusation.outcomes).forEach((outcome) => {
    if (!maps.endings.has(outcome.endingId)) return
    edges.push({
      id: `outcome-ending:${outcome.id}:${outcome.endingId}`,
      source: outcome.id,
      target: outcome.endingId,
      relation: 'ending',
      label: 'показывает',
      persistent: true,
    })
  })

  return { nodes, edges, matchedIds: new Set() }
}

export const buildStoryInvestigationGraph = (game, options = {}) => {
  const mode = options.mode || 'logic'
  const query = String(options.query || '').trim()
  const maps = createEntityMaps(game)
  const index = buildReferenceIndex(game, maps)
  index.maps = maps

  const view = mode === 'locations'
    ? buildLocationsView(game, maps)
    : mode === 'finals'
      ? buildFinalsView(game, maps)
      : buildLogicView(game, maps, index, query)

  return {
    ...view,
    mode,
    maps,
    index,
    diagnostics: collectDiagnostics(game, maps),
  }
}

export const getStoryGraphNeighborhood = (graph, selectedId) => {
  if (!selectedId) return { nodeIds: new Set(), edgeIds: new Set(), refKeys: new Set() }
  const nodeIds = new Set([selectedId])
  const edgeIds = new Set()
  const refKeys = new Set()

  graph.edges.forEach((edge) => {
    if (edge.source === selectedId || edge.target === selectedId) {
      nodeIds.add(edge.source)
      nodeIds.add(edge.target)
      edgeIds.add(edge.id)
      if (edge.refKey) refKeys.add(edge.refKey)
    }
  })

  return { nodeIds, edgeIds, refKeys }
}

export default buildStoryInvestigationGraph
